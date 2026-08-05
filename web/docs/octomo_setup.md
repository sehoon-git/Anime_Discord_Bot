# OCTOMO phone verification

Set `OCTOMO_API_KEY` in the Vercel project environment variables for every deployed environment.

The signup flow accepts Korean `010` mobile numbers, creates a short-lived verification code, and opens a message addressed to OCTOMO's representative number. The user sends that code, then selects `인증 완료 확인`. The server verifies the sent message through OCTOMO before saving the profile.

The saved profile locale defaults to `en-US` and changes to `ko-KR` after Korean phone verification. Users can change it later from Settings; the same saved locale is used by the web shell and Discord turn response prompt.
