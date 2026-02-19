drop policy if exists "Org owner/manager/staff can update media asset segments" on public.media_asset_segments;

create policy "Org owner/manager/staff can update media asset segments"
on public.media_asset_segments
for update
to public
using (
  exists (
    select 1
    from public.media_assets
    join public.org_members on org_members.org_id = media_assets.org_id
    where media_assets.id = media_asset_segments.media_asset_id
      and org_members.user_id = auth.uid()
      and org_members.role = any (array['owner'::public.org_role, 'manager'::public.org_role, 'staff'::public.org_role])
  )
)
with check (
  exists (
    select 1
    from public.media_assets
    join public.org_members on org_members.org_id = media_assets.org_id
    where media_assets.id = media_asset_segments.media_asset_id
      and org_members.user_id = auth.uid()
      and org_members.role = any (array['owner'::public.org_role, 'manager'::public.org_role, 'staff'::public.org_role])
  )
);
