Here are the current policies configured:

Admin can read all media assets

FOR SELECT
USING: is_admin()
Roles: all (no TO specified)
Admin or owner/manager/staff can delete media assets

FOR DELETE
TO authenticated
USING: user is org member with role IN (owner, manager, staff) for the row’s org_id OR is_admin()
Org members can read media assets

FOR SELECT
TO authenticated
USING: user is a member of the row’s org_id
Org staff or admin can insert media assets

FOR INSERT
TO authenticated
WITH CHECK: uploader_id = auth.uid() AND (user is org member with role IN (owner, manager, staff) for org_id OR is_admin())
Org staff or admin can read media assets

FOR SELECT
TO authenticated
USING: user is org member with role IN (owner, manager, staff) for org_id OR is_admin()
Uploaders can Update

FOR UPDATE
USING: true
Note: No WITH CHECK provided; this effectively allows updates to proceed if other policies allow the row to be targeted. This may be overly permissive unless constrained elsewhere.
media_assets_select_org_members

FOR SELECT
TO authenticated
USING: user is a member of the row’s org_id
Note: Duplicates the “Org members can read media assets” condition.