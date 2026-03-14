$ErrorActionPreference = "Stop"

function Assert-True($condition, $message) {
  if (-not $condition) {
    throw "ASSERTION FAILED: $message"
  }
}

$port = if ($env:SUBEEJ_CHAT_TEST_PORT) { $env:SUBEEJ_CHAT_TEST_PORT } else { "5173" }
$base = "http://localhost:$port/api/llm/chat"

Write-Host "Test 1: greeting intent"
$greet = Invoke-RestMethod -Uri $base -Method POST -ContentType "application/json" -Body (@{ message = "hi" } | ConvertTo-Json)
Assert-True ($greet.reply -match "Hello") "Greeting should return welcome response."
Assert-True ([bool]$greet.session_id) "Greeting should return session_id."

$sid = $greet.session_id

Write-Host "Test 2: partial extraction and targeted follow-up"
$partialBody = @{
  message = "I live in Maharashtra in Nashik"
  session_id = $sid
} | ConvertTo-Json
$partial = Invoke-RestMethod -Uri $base -Method POST -ContentType "application/json" -Body $partialBody
Assert-True ($partial.reply -match "soil|field composition") "Extractor should capture Nashik and ask for soil instead of district."
Assert-True ($partial.reply -notmatch "State:|District:") "Partial response should not echo stored values."

Write-Host "Test 3: informational seed question should not trigger field collection"
$seedInfoBody = @{ message = "I need to know about seed"; session_id = $sid } | ConvertTo-Json
$seedInfo = Invoke-RestMethod -Uri $base -Method POST -ContentType "application/json" -Body $seedInfoBody
Assert-True ($seedInfo.reply -notmatch "state|district") "General seed question should not start field collection."
Assert-True ($seedInfo.reply -match "seed") "General seed question should stay in informational mode."

Write-Host "Test 4: help intent"
$helpBody = @{ message = "guide me"; session_id = $sid } | ConvertTo-Json
$help = Invoke-RestMethod -Uri $base -Method POST -ContentType "application/json" -Body $helpBody
Assert-True ($help.reply -match "recommendation|suitability|agronomy") "Help should stay conversational."

Write-Host "Test 5: pending district capture from one-word reply"
$districtStartBody = @{
  message = "My field is in Maharashtra"
  session_id = $sid
} | ConvertTo-Json
$districtStart = Invoke-RestMethod -Uri $base -Method POST -ContentType "application/json" -Body $districtStartBody
Assert-True ($districtStart.reply -match "district") "Assistant should ask for district."

$districtAnswerBody = @{
  message = "Palghar"
  session_id = $sid
} | ConvertTo-Json
$districtAnswer = Invoke-RestMethod -Uri $base -Method POST -ContentType "application/json" -Body $districtAnswerBody
Assert-True ($districtAnswer.reply -notmatch "Tell me what you want to do") "Pending district answer should not hit generic fallback."
Assert-True ($districtAnswer.reply -notmatch "District:") "Pending district answer should not echo raw field labels."

Write-Host "Test 6: pending season capture from one-word reply"
$seasonStartBody = @{
  message = "My field is in Maharashtra, district Palghar, black soil"
  session_id = $sid
} | ConvertTo-Json
$seasonStart = Invoke-RestMethod -Uri $base -Method POST -ContentType "application/json" -Body $seasonStartBody
Assert-True ($seasonStart.reply -match "Kharif|Rabi|Zaid") "Assistant should ask for season."

$seasonAnswerBody = @{
  message = "Rabi"
  session_id = $sid
} | ConvertTo-Json
$seasonAnswer = Invoke-RestMethod -Uri $base -Method POST -ContentType "application/json" -Body $seasonAnswerBody
Assert-True ($seasonAnswer.reply -notmatch "Tell me what you want to do") "Pending season answer should not hit generic fallback."
Assert-True ($seasonAnswer.reply -match "moisture|rainfall|humidity|temperature|What would you like help with next") "Pending season answer should continue the flow."

Write-Host "Test 7: pending moisture capture from one-word reply"
$moistureStartBody = @{
  message = "My field is in Maharashtra, district Palghar, black soil, Rabi"
  session_id = $sid
} | ConvertTo-Json
$moistureStart = Invoke-RestMethod -Uri $base -Method POST -ContentType "application/json" -Body $moistureStartBody
Assert-True ($moistureStart.reply -match "moisture") "Assistant should ask for moisture."

$moistureAnswerBody = @{
  message = "dry"
  session_id = $sid
} | ConvertTo-Json
$moistureAnswer = Invoke-RestMethod -Uri $base -Method POST -ContentType "application/json" -Body $moistureAnswerBody
Assert-True ($moistureAnswer.reply -notmatch "Field moisture condition") "Moisture answer should be stored without data echoing."

Write-Host "Test 8: field quality one-word answer should not auto-recommend"
$qualityStartBody = @{
  message = "My field is in Maharashtra, district Palghar, black soil, Rabi, dry, low rainfall, medium humidity, temperature 22"
  session_id = $sid
} | ConvertTo-Json
$qualityStart = Invoke-RestMethod -Uri $base -Method POST -ContentType "application/json" -Body $qualityStartBody
Assert-True ($qualityStart.reply -match "field quality") "Assistant should ask for field quality."

$qualityAnswerBody = @{
  message = "low"
  session_id = $sid
} | ConvertTo-Json
$qualityAnswer = Invoke-RestMethod -Uri $base -Method POST -ContentType "application/json" -Body $qualityAnswerBody
Assert-True ($qualityAnswer.reply -match "What would you like help with next") "Enough fields should move to ready_for_action, not auto recommendation."
Assert-True ($qualityAnswer.reply -notmatch "Recommended crop") "Ready_for_action should not auto-run recommendation."

Write-Host "Test 9: compatibility response shape"
$compatBody = @{
  session_id = $sid
  message = "My field is in Maharashtra, district Pune, black soil, Kharif season, I have wheat seed, is it suitable now?"
} | ConvertTo-Json
$compat = Invoke-RestMethod -Uri $base -Method POST -ContentType "application/json" -Body $compatBody
Assert-True ($compat.reply -match "Suitability:") "Compatibility response should use suitability format."
Assert-True ($compat.reply -notmatch "Recommended crop:") "Compatibility response should not use generic recommendation format."

Write-Host "Test 10: complaint recovery"
$complaintBody = @{
  session_id = $sid
  message = "I never asked about crop recommendation"
} | ConvertTo-Json
$complaint = Invoke-RestMethod -Uri $base -Method POST -ContentType "application/json" -Body $complaintBody
Assert-True ($complaint.reply -match "You're right|What would you like next") "Complaint should be acknowledged naturally."
Assert-True ($complaint.reply -notmatch "Recommended crop:") "Complaint recovery should not repeat recommendation output."

Write-Host "Test 11: recommendation output validity"
$recBody = @{
  session_id = $sid
  field_input = @{
    seed_name = "Maize seed"
    seed_variety = "PMH1"
    seed_type = "Desi"
    seed_quality = "Old"
    suitable_land_type_for_seed = "Sandy Loam"
    field_quality = "High"
    field_history_or_crops = "Rice"
    field_composition = "Loose sandy-loam texture, porous and well-aerated"
    moisture = 41
    humidity = 65
    rainfall = 625
    temperature = 30
    state = "Bihar"
    district = "Patna"
    suitable_crop_for_field = "Maize"
    season = "Kharif"
  }
} | ConvertTo-Json -Depth 6
$rec = Invoke-RestMethod -Uri $base -Method POST -ContentType "application/json" -Body $recBody
Assert-True ([bool]$rec.recommended_crop) "Recommendation should include crop."
Assert-True ([bool]$rec.recommended_seed) "Recommendation should include seed."
Assert-True ($rec.confidence_score -ge 0 -and $rec.confidence_score -le 1) "Confidence should be in [0,1]."
Assert-True ($rec.source_rows_used.Count -ge 1) "Recommendation should include source rows."

Write-Host "All chat behavior tests passed."
