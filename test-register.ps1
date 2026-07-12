$body = '{"email":"testregister456@example.com","password":"Test1234!","name":"Test User"}'
$response = Invoke-RestMethod -Uri "https://rp-18pf.onrender.com/api/auth/register" -Method POST -ContentType "application/json" -Body $body
$response | ConvertTo-Json
