@@
   // Create importer record
   const importer = await Importer.create(payload);

   // set resource id for audit
   res.locals.resourceId = importer.importer_id || importer.id || null;

   // If contact_email provided, attempt to create login user and activate immediately
   const contactEmail = String(payload.contact_email || "").trim().toLowerCase();
+  let createdTempPassword = null;
   const requestedPassword = String(req.body?.login_password || "").trim();
   const autoUser = { attempted: false, created: false, email: contactEmail || null, message: null };

   if (contactEmail) {
@@
           await pool.query(
             `INSERT INTO users (full_name, email, password_hash, ${roleCol}, must_change_password, status)
              VALUES ($1, $2, $3, $4, $5, $6)`,
             [fullName, contactEmail, passwordHash, roleId, requestedPassword ? false : true, 'active']
           );

+          // if generated password, persist as notification for email later
+          if (!requestedPassword) {
+            createdTempPassword = generatedPassword;
+            try {
+              const uRow = await pool.query('SELECT id, user_id FROM users WHERE email=$1 LIMIT 1', [contactEmail]);
+              const recipientId = uRow.rows[0].id || uRow.rows[0].user_id;
+              await pool.query(`INSERT INTO notifications (recipient_id, channel, title, body, metadata) VALUES ($1,'system','Temporary credentials','Temporary credentials created', $2)`, [recipientId, { temporary_password: generatedPassword, type: 'temp_credentials', email: contactEmail }]);
+            } catch (e) {}
+          }
+
           autoUser.created = true;
           autoUser.temporary_password = requestedPassword ? null : generatedPassword;
           autoUser.message = requestedPassword
             ? "Importer login user created with provided password."
             : "Importer login user created with generated temporary password.";
         }
       }
     }
 
-    res.status(201).json({ ...importer, login_user: autoUser });
+    // Send immediate notification email if admin created user with generated password
+    if (createdTempPassword && contactEmail) {
+      try {
+        const { sendApprovalEmail } = await import('../utils/mail.js');
+        await sendApprovalEmail(contactEmail, importer.company_name || importer.importer_name || importer.contact_person || 'Importer', createdTempPassword);
+      } catch (e) {}
+    }
+
+    res.status(201).json({ ...importer, login_user: autoUser });
