;; AutoLISP ConstructSystem (v18.6)
;;
;; This program places blocks and draws lines based on data from a text file.
;; It uses a hybrid approach for speed: (entmake) for static blocks and lines,
;; and a "Create and Copy" method for dynamic blocks.
;; v18.4 Update: Line processing enhanced for multiple lines per entry.
;; v18.5 Update: Improved feedback for dynamic property setting (handles numbers and strings).
;; v18.6 Update: Added optional LayerName property for all entities.
;;
;; To Use:
;;
;; --- 1. In Your Spreadsheet or Text Editor ---
;;
;; a. The format for each line in the text file is:
;;    {EntityType,Properties...|OptionalDynamicProps|Coordinates...}
;;
;; b. **Format for BLOCKS with dynamic properties:**
;;    {BlockName,Color,Rotation[,LayerName]|PropName1:Value1;...|(x,y,z)...}
;;    (e.g., |Visibility1:MyState;Length:120|)
;;
;; c. **Format for BLOCKS WITHOUT dynamic properties (Static Blocks):**
;;    {BlockName,Color,Rotation[,LayerName]|(x,y,z)...}
;;
;; d. **Format for LINES (Multiple lines in one entry):**
;;    {LINE,Color[,LayerName]|(startX1,Y1,Z1)(endX1,Y1,Z1)...}
;;
;; e. **Note on Layers:**
;;    - LayerName is optional for all entities.
;;    - If omitted, the object is created on the current layer.
;;    - If the specified layer does not exist, a warning is printed,
;;      and the object will be created on the current layer.
;;
;; f. Sort your data to group items with the same properties for optimal performance.
;;
;; --- 2. In AutoCAD ---
;;
;; a. Load this file.
;; b. Type the command "CONSTRUCTSYSTEM" and press Enter.
;; c. Select a base point that will serve as the origin (0,0,0).
;; d. Paste your data strings into the Notepad window that opens, SAVE, and CLOSE it.
;; e. Return to AutoCAD and press Enter to begin the process.
;;

;; HELPER FUNCTION: String splitter
(defun CS-str-split (str delim / pos lst)
  (setq lst '())
  (while (setq pos (vl-string-search delim str))
    (setq lst (cons (substr str 1 pos) lst))
    (setq str (substr str (+ pos 1 (strlen delim))))
  )
  (setq lst (cons str lst))
  (reverse lst)
)

;; HELPER FUNCTION: Sets a SINGLE dynamic property. (v18.5 - Improved Feedback)
(defun CS-set-single-prop (vla-obj prop-name prop-value-str / vla-props props-list found-prop catch-result)
  (if (and vla-obj (vlax-property-available-p vla-obj "IsDynamicBlock") (= :vlax-true (vla-get-isdynamicblock vla-obj)))
    (progn
      (setq vla-props (vla-getdynamicblockproperties vla-obj))
      (setq props-list (vlax-safearray->list (vlax-variant-value vla-props)))
      
      (setq found-prop nil)
      (foreach current-vla-prop props-list
        (if (and (not found-prop) (= (strcase (vla-get-propertyname current-vla-prop)) (strcase prop-name)))
          (progn
            (setq found-prop T)
            
            ;; Try setting as a number first (for lengths, angles, etc.)
            (setq catch-result (vl-catch-all-apply 'vla-put-value (list current-vla-prop (distof prop-value-str))))
            
            (if (vl-catch-all-error-p catch-result)
              (progn
                ;; First attempt failed, try setting as a string (for Table rows, Visibility states, etc.)
                (setq catch-result (vl-catch-all-apply 'vla-put-value (list current-vla-prop prop-value-str)))
                
                (if (vl-catch-all-error-p catch-result)
                  ;; Both attempts failed
                  (princ (strcat "\n   -> ERROR setting property '" prop-name "': " (vl-catch-all-error-message catch-result)))
                  ;; String attempt succeeded
                  (princ (strcat "\n   -> Set property '" prop-name "' to STRING: \"" prop-value-str "\""))
                )
              )
              ;; Number attempt succeeded
              (princ (strcat "\n   -> Set property '" prop-name "' to NUMBER: " prop-value-str))
            )
          )
        )
      )
      (if (not found-prop) (princ (strcat "\n   -> WARNING: Dynamic property '" prop-name "' not found in block.")))
    )
  )
)


;; MAIN COMMAND FUNCTION
(defun c:ConstructSystem ( / *error* temp_file file_handle line base_point count total_count group_str group_parts prop_str dyn_props_str coord_str prop_parts entity_type color_idx rotation_degrees rotation_radians coord_groups coord_group clean_coord_group coord_parts x y z insertion_point last_ent vla_obj old_cmdecho old_osmode template_vla_obj first_pt copy_vla_obj move_pt prop_list-str prop-pair prop-name-val prop-name prop-value-str start_pt end_pt layer_name ent_data)

  ;; --- Custom Error Handler ---
  (setq old_error *error*)
  (defun *error* (msg)
    (if old_cmdecho (setvar "CMDECHO" old_cmdecho))
    (if old_osmode (setvar "OSMODE" old_osmode)) ; Restore OSNAP settings
    (if (and temp_file (findfile temp_file)) (vl-file-delete temp_file))
    (if (not (wcmatch (strcase msg) "*CANCEL*,*QUIT*")) (princ (strcat "\nError: " msg)))
    (setq *error* old_error)
    (princ)
  )

  (vl-load-com)
  ;; --- Save current settings and turn them off ---
  (setq old_cmdecho (getvar "CMDECHO"))
  (setq old_osmode (getvar "OSMODE"))
  (setvar "CMDECHO" 0)
  (setvar "OSMODE" 0)

  ;; --- 1. Get Base Point from User ---
  (setq base_point (getpoint "\nSelect a base point for the system layout (new 0,0,0): ") total_count 0)

  (if base_point
    (progn
      (princ "\nOpening a temporary text file...")
      (setq temp_file (vl-filename-mktemp "ConstructSystemData.txt"))
      (setq file_handle (open temp_file "w")) (close file_handle)
      (startapp "notepad.exe" temp_file)
      (getstring "\nPaste your data, save and close the file, then press Enter here.")

      (if (and temp_file (findfile temp_file))
        (progn
          (setq file_handle (open temp_file "r"))
          (princ "\nProcessing data... Please wait.")
          
          (while (setq group_str (read-line file_handle))
            (setq group_str (vl-string-trim " \t\r\n{}\"" group_str))
            (if (> (strlen group_str) 0)
              (progn
                (setq group_parts (CS-str-split group_str "|"))
                (setq prop_str nil dyn_props_str nil coord_str nil)

                (cond
                  ((= 3 (length group_parts)) (setq prop_str (nth 0 group_parts) dyn_props_str (nth 1 group_parts) coord_str (nth 2 group_parts)))
                  ((= 2 (length group_parts)) (setq prop_str (nth 0 group_parts) coord_str (nth 1 group_parts)))
                  (t (princ (strcat "\nSkipping invalid data line: " group_str)))
                )

                (if (and prop_str coord_str)
                  (progn
                    (setq prop_parts (CS-str-split prop_str ","))
                    (setq entity_type (vl-string-trim " {}\"" (nth 0 prop_parts)))
                    (setq layer_name nil) ; Initialize layer name for this group

                    ;; --- BRANCH 1: Process LINE entities ---
                    (if (= (strcase entity_type) "LINE")
                      (if (>= (length prop_parts) 2) ; At least LINE,Color
                        (progn
                          (princ (strcat "\nProcessing LINE group..."))
                          (setq count 0)
                          (setq color_idx (atoi (nth 1 prop_parts)))
                          ;; Check for optional LayerName
                          (if (>= (length prop_parts) 3)
                            (setq layer_name (vl-string-trim " " (nth 2 prop_parts)))
                          )
                          
                          (setq coord_groups (vl-remove "" (CS-str-split coord_str ")")))
                          
                          ;; *** UPDATED LOGIC (v18.4) ***
                          ;; Check for an even number of points (start/end pairs)
                          (if (zerop (rem (length coord_groups) 2))
                            (progn
                              ;; Loop through coordinate pairs
                              (while coord_groups
                                ;; Parse Start Point
                                (setq clean_coord_group (vl-string-trim " \t\r\n(" (car coord_groups)))
                                (setq coord_parts (CS-str-split clean_coord_group ","))
                                (setq x (distof (nth 0 coord_parts)) y (distof (nth 1 coord_parts)) z (distof (nth 2 coord_parts)))
                                (setq start_pt (list (+ x (car base_point)) (+ y (cadr base_point)) (+ z (caddr base_point))))
                                
                                ;; Parse End Point
                                (setq clean_coord_group (vl-string-trim " \t\r\n(" (cadr coord_groups)))
                                (setq coord_parts (CS-str-split clean_coord_group ","))
                                (setq x (distof (nth 0 coord_parts)) y (distof (nth 1 coord_parts)) z (distof (nth 2 coord_parts)))
                                (setq end_pt (list (+ x (car base_point)) (+ y (cadr base_point)) (+ z (caddr base_point))))

                                ;; Create the line
                                (setq ent_data (list (cons 0 "LINE") (cons 62 color_idx) (cons 10 start_pt) (cons 11 end_pt)))
                                ;; Add optional layer if specified and valid
                                (if (and layer_name (/= layer_name ""))
                                  (if (tblsearch "LAYER" layer_name)
                                    (setq ent_data (cons (cons 8 layer_name) ent_data))
                                    (princ (strcat "\n  -> WARNING: Layer '" layer_name "' not found for LINE. Using current layer."))
                                  )
                                )
                                (entmake ent_data)
                                
                                (setq count (1+ count) total_count (1+ total_count))
                                
                                ;; Advance list to the next pair
                                (setq coord_groups (cddr coord_groups))
                              )
                              (princ (strcat " " (itoa count) (if (= count 1) " line" " lines") " inserted."))
                            )
                            (princ (strcat "\nWARNING: Odd number of coordinates for LINE group. Each line requires a start and end point. Skipping group."))
                          )
                        )
                        (princ (strcat "\nWARNING: Invalid properties for LINE: " prop_str))
                      )
                      ;; --- BRANCH 2: Process BLOCK entities ---
                      (progn
                        (if (>= (length prop_parts) 3) ; At least BlockName,Color,Rotation
                          (progn
                            (setq color_idx (atoi (nth 1 prop_parts)))
                            (setq rotation_degrees (distof (nth 2 prop_parts)))
                            ;; Check for optional LayerName
                            (if (>= (length prop_parts) 4)
                              (setq layer_name (vl-string-trim " " (nth 3 prop_parts)))
                            )
                            
                            (if (tblsearch "BLOCK" entity_type)
                              (progn
                                (setq count 0)
                                (setq coord_groups (CS-str-split coord_str ")"))
                                
                                (if dyn_props_str
                                  ;; --- DYNAMIC BLOCKS ---
                                  (progn
                                    (princ (strcat "\nProcessing dynamic group '" entity_type "' using Create-and-Copy..."))
                                    (setq first_coord_group (car coord_groups))
                                    (setq clean_coord_group (vl-string-trim " \t\r\n(" first_coord_group))
                                    (if (> (strlen clean_coord_group) 0)
                                      (progn
                                        (setq coord_parts (CS-str-split clean_coord_group ","))
                                        (setq x (distof (nth 0 coord_parts)) y (distof (nth 1 coord_parts)) z (distof (nth 2 coord_parts)))
                                        (setq first_pt (list (+ x (car base_point)) (+ y (cadr base_point)) (+ z (caddr base_point))))
                                        
                                        (command "._-INSERT" entity_type first_pt "1" "1" rotation_degrees)
                                        (setq template_vla_obj (vlax-ename->vla-object (entlast)))
                                        
                                        (if template_vla_obj
                                          (progn
                                            (vla-put-Color template_vla_obj color_idx)
                                            
                                            ;; Set optional layer for template object
                                            (if (and layer_name (/= layer_name ""))
                                              (if (tblsearch "LAYER" layer_name)
                                                (vla-put-Layer template_vla_obj layer_name)
                                                (princ (strcat "\n  -> WARNING: Layer '" layer_name "' not found. Block '" entity_type "' remains on current layer."))
                                              )
                                            )
                                            
                                            (setq prop_list-str (CS-str-split dyn_props_str ";"))
                                            (foreach prop-pair prop_list-str
                                              (setq prop-name-val (CS-str-split prop-pair ":"))
                                              (if (= 2 (length prop-name-val))
                                                (progn
                                                  (setq prop-name (vl-string-trim " " (car prop-name-val)))
                                                  (setq prop-value-str (vl-string-trim " " (cadr prop-name-val)))
                                                  (CS-set-single-prop template_vla_obj prop-name prop-value-str)
                                                )
                                              )
                                            )
                                            (setq count (1+ count) total_count (1+ total_count))
                                            (foreach coord_group (cdr coord_groups)
                                              (setq clean_coord_group (vl-string-trim " \t\r\n(" coord_group))
                                              (if (> (strlen clean_coord_group) 0)
                                                (progn
                                                  (setq coord_parts (CS-str-split clean_coord_group ","))
                                                  (setq x (distof (nth 0 coord_parts)) y (distof (nth 1 coord_parts)) z (distof (nth 2 coord_parts)))
                                                  (setq move_pt (list (+ x (car base_point)) (+ y (cadr base_point)) (+ z (caddr base_point))))
                                                  (setq copy_vla_obj (vla-copy template_vla_obj))
                                                  (vla-move copy_vla_obj (vlax-3d-point first_pt) (vlax-3d-point move_pt))
                                                  (setq count (1+ count) total_count (1+ total_count))
                                                )
                                              )
                                            )
                                          )
                                        )
                                      )
                                    )
                                  )
                                  ;; --- STATIC BLOCKS ---
                                  (progn
                                    (princ (strcat "\nProcessing static group '" entity_type "' using (entmake)..."))
                                    (setq rotation_radians (* rotation_degrees (/ pi 180.0)))
                                    (foreach coord_group coord_groups
                                      (setq clean_coord_group (vl-string-trim " \t\r\n(" coord_group))
                                      (if (> (strlen clean_coord_group) 0)
                                        (progn
                                          (setq coord_parts (CS-str-split clean_coord_group ","))
                                          (setq x (distof (nth 0 coord_parts)) y (distof (nth 1 coord_parts)) z (distof (nth 2 coord_parts)))
                                          (setq insertion_point (list (+ x (car base_point)) (+ y (cadr base_point)) (+ z (caddr base_point))))
                                          
                                          ;; Build entmake list
                                          (setq ent_data (list (cons 0 "INSERT") (cons 2 entity_type) (cons 62 color_idx) (cons 10 insertion_point) (cons 50 rotation_radians)))
                                          ;; Add optional layer if specified and valid
                                          (if (and layer_name (/= layer_name ""))
                                            (if (tblsearch "LAYER" layer_name)
                                              (setq ent_data (cons (cons 8 layer_name) ent_data))
                                              (princ (strcat "\n  -> WARNING: Layer '" layer_name "' not found for Block. Using current layer."))
                                            )
                                          )
                                          (entmake ent_data)
                                          
                                          (setq count (1+ count) total_count (1+ total_count))
                                        )
                                      )
                                    )
                                  )
                                )
                                (princ (strcat " " (itoa count) " blocks inserted."))
                              )
                              (princ (strcat "\nWARNING: Block '" entity_type "' not found. Skipping group."))
                            )
                          )
                          (princ (strcat "\nWARNING: Invalid property format for Block '" entity_type "'. Expected at least BlockName,Color,Rotation."))
                        )
                      )
                    )
                  )
                )
              )
            )
          ) ; end while
          (close file_handle)
          (vl-file-delete temp_file)
          (princ (strcat "\n\nFinished. Inserted a total of " (itoa total_count) " objects (blocks and lines)."))
        )
      )
    )
    (princ "\nOperation cancelled. No base point selected.")
  )

  ;; --- Restore original settings ---
  (setvar "CMDECHO" old_cmdecho)
  (setvar "OSMODE" old_osmode)
  (setq *error* old_error)
  (princ)
)

;; A message to the user after the file is loaded
(princ "\n'ConstructSystem' command (v18.6) loaded. Type CONSTRUCTSYSTEM to run.")
(princ)