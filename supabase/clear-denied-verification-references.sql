update public.profiles
set
  id_photo_url = null,
  selfie_url = null,
  selfie_with_id_url = null
where verification_status = 'rejected';
