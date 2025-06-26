# Learning Progress API Testing Guide

## Base URL
```
http://localhost:8000/api/learning
```

## 1. Health Check
```bash
curl -X GET http://localhost:8000/api/learning/health
```

## 2. API Documentation
```bash
curl -X GET http://localhost:8000/api/learning/docs
```

## 3. Initialize Progress
```bash
curl -X POST http://localhost:8000/api/learning/lessons/683ab2772651632e975a79b4/initialize \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "6751f9a7e885b94f3e77bc40",
    "totalSlides": 10,
    "lessonTitle": "Bài học Toán lớp 3"
  }'
```

## 4. Update Slide Position
```bash
curl -X PUT http://localhost:8000/api/learning/lessons/683ab2772651632e975a79b4/slide-position \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "6751f9a7e885b94f3e77bc40",
    "slideIndex": 5,
    "slideId": "slide_5",
    "timeSpentOnSlide": 30000
  }'
```

## 5. Get All User Progress
```bash
curl -X GET http://localhost:8000/api/learning/users/6751f9a7e885b94f3e77bc40/progress
```

## 6. Get Specific Lesson Progress
```bash
curl -X GET http://localhost:8000/api/learning/users/6751f9a7e885b94f3e77bc40/lessons/683ab2772651632e975a79b4/progress
```

## 7. Start Learning Session
```bash
curl -X POST http://localhost:8000/api/learning/lessons/683ab2772651632e975a79b4/sessions/start \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "6751f9a7e885b94f3e77bc40",
    "deviceInfo": {
      "userAgent": "Mozilla/5.0...",
      "platform": "Web",
      "screenResolution": "1920x1080"
    }
  }'
```

## 8. Submit Exercise Result
```bash
curl -X POST http://localhost:8000/api/learning/lessons/683ab2772651632e975a79b4/exercises/submit \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "6751f9a7e885b94f3e77bc40",
    "exerciseId": "exercise_1",
    "score": 85,
    "type": "quiz",
    "answers": [1, 3, 2, 0],
    "attempts": 1
  }'
```

## 9. Get User Dashboard
```bash
curl -X GET http://localhost:8000/api/learning/users/6751f9a7e885b94f3e77bc40/dashboard
```

## 10. Bulk Update Progress
```bash
curl -X POST http://localhost:8000/api/learning/progress/bulk-update \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "6751f9a7e885b94f3e77bc40",
    "progressUpdates": [
      {
        "lessonId": "683ab2772651632e975a79b4",
        "slideIndex": 3,
        "timeSpent": 15000,
        "totalSlides": 10
      },
      {
        "lessonId": "683ab2772651632e975a79b5",
        "slideIndex": 1,
        "timeSpent": 8000,
        "totalSlides": 8
      }
    ]
  }'
```

## 11. Reset Lesson Progress (Dev Only)
```bash
curl -X DELETE http://localhost:8000/api/learning/users/6751f9a7e885b94f3e77bc40/lessons/683ab2772651632e975a79b4/progress
```

## Testing Sequence

### Scenario 1: First Time Learning
```bash
# 1. Initialize lesson
curl -X POST http://localhost:8000/api/learning/lessons/683ab2772651632e975a79b4/initialize \
  -H "Content-Type: application/json" \
  -d '{"userId": "6751f9a7e885b94f3e77bc40", "totalSlides": 10, "lessonTitle": "Test Lesson"}'

# 2. Start session
curl -X POST http://localhost:8000/api/learning/lessons/683ab2772651632e975a79b4/sessions/start \
  -H "Content-Type: application/json" \
  -d '{"userId": "6751f9a7e885b94f3e77bc40", "deviceInfo": {"platform": "Web"}}'

# 3. Update slide position multiple times
curl -X PUT http://localhost:8000/api/learning/lessons/683ab2772651632e975a79b4/slide-position \
  -H "Content-Type: application/json" \
  -d '{"userId": "6751f9a7e885b94f3e77bc40", "slideIndex": 0}'

curl -X PUT http://localhost:8000/api/learning/lessons/683ab2772651632e975a79b4/slide-position \
  -H "Content-Type: application/json" \
  -d '{"userId": "6751f9a7e885b94f3e77bc40", "slideIndex": 5}'

# 4. Check progress
curl -X GET http://localhost:8000/api/learning/users/6751f9a7e885b94f3e77bc40/lessons/683ab2772651632e975a79b4/progress
```

### Scenario 2: Continuing Lesson
```bash
# 1. Get existing progress
curl -X GET http://localhost:8000/api/learning/users/6751f9a7e885b94f3e77bc40/progress

# 2. Continue from last position
curl -X PUT http://localhost:8000/api/learning/lessons/683ab2772651632e975a79b4/slide-position \
  -H "Content-Type: application/json" \
  -d '{"userId": "6751f9a7e885b94f3e77bc40", "slideIndex": 9}'

# 3. Complete lesson (100%)
curl -X PUT http://localhost:8000/api/learning/lessons/683ab2772651632e975a79b4/slide-position \
  -H "Content-Type: application/json" \
  -d '{"userId": "6751f9a7e885b94f3e77bc40", "slideIndex": 9}'
```

## Expected Response Formats

### Success Response
```json
{
  "success": true,
  "message": "Operation successful",
  "data": {
    // Response data
  }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message"
}
```

## Integration with Frontend Redux

### API Service Example
```javascript
// frontend/src/services/learningAPI.js
export const learningAPI = {
  initializeProgress: (lessonId, userId, totalSlides, lessonTitle) =>
    api.post(`/learning/lessons/${lessonId}/initialize`, {
      userId, totalSlides, lessonTitle
    }),
    
  updateSlidePosition: (lessonId, userId, slideIndex, slideId) =>
    api.put(`/learning/lessons/${lessonId}/slide-position`, {
      userId, slideIndex, slideId
    }),
    
  getAllProgress: (userId) =>
    api.get(`/learning/users/${userId}/progress`),
    
  // ... other methods
};
```
