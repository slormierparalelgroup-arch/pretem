delete from storage.objects object
using public.profiles profile
where profile.verification_status = 'rejected'
  and object.bucket_id = 'selfies'
  and object.name in (
    profile.id_photo_url,
    profile.selfie_url,
    profile.selfie_with_id_url
  );

update public.profiles
set
  id_photo_url = null,
  selfie_url = null,
  selfie_with_id_url = null
where verification_status = 'rejected';
