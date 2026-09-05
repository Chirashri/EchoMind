# EchoMind — Secure AI Reflection & Personal Growth Companion

EchoMind is a user-authenticated, privacy-first reflection and personal growth companion powered by Google Gemini and Google Cloud Firestore. Designed with zero-trust architectural boundaries, EchoMind provides multi-turn conversational reflection, automated session synthesis, longitudinal pattern analysis via the **Pattern Compass**, and complete personal data sovereignty via a dedicated **Privacy Center**.

---

## 🚀 Live Demo

🔗 [Try EchoMind Live] (https://echomind-32440829381.asia-southeast1.run.app)

## Architecture & Security Model

- **Authentication**: Firebase Authentication with Google Sign-In (`signInWithPopup`).
- **Authorization & Token Verification**: Backend never trusts client-asserted UIDs. Every protected API endpoint verifies the Firebase JWT ID token and derives the `userId` strictly from the cryptographically verified token claims.
- **Strict User Data Isolation**:
  - `users/{userId}/conversations/{conversationId}`
  - `users/{userId}/conversations/{conversationId}/messages/{messageId}`
  - `users/{userId}/insights/{insightId}`
- **Zero Client Secrets**: Gemini API keys are strictly retained server-side in Cloud Run / Express proxy.
- **Resilient Fallback Ladder**: Backend incorporates a multi-tier fallback protocol (`gemini-3.8-flash` → `gemini-3.6-flash` → `gemini-3.1-flash-lite` → `gemini-flash-latest` → `gemini-3.7-flash`).

---

## 1. Prerequisites & GCP API Enablement

Before deploying to Google Cloud Run, ensure the Google Cloud SDK (`gcloud`) is installed and authenticated to your project:

```bash
# 1. Authenticate with Google Cloud
gcloud auth login

# 2. Set your active Project ID
export PROJECT_ID="YOUR_PROJECT_ID"
export REGION="asia-southeast1" # or your chosen region (e.g. us-central1)
gcloud config set project $PROJECT_ID

# 3. Enable required Google Cloud APIs
gcloud services enable \
  run.googleapis.com \
  secretmanager.googleapis.com \
  firestore.googleapis.com \
  identitytoolkit.googleapis.com
```

---

## 2. Google Cloud Secret Manager Configuration

To adhere to zero-hardcoding hygiene, configure your `GEMINI_API_KEY` in Google Cloud Secret Manager:

```bash
# 1. Create and populate the secret
gcloud secrets create GEMINI_API_KEY --replication-policy="automatic"
echo -n "YOUR_GEMINI_API_KEY" | gcloud secrets versions add GEMINI_API_KEY --data-file=-

# 2. Retrieve your project number
export PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")

# 3. Grant the default Cloud Run Compute service account access to read the secret
gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

## 3. Firestore Security Rules Configuration

Deploy the hardened, user-isolated Firestore security rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }

    function isSignedIn() {
      return request.auth != null;
    }

    function isOwner(userId) {
      return isSignedIn() && request.auth.uid == userId;
    }

    function isValidId(id) {
      return id is string && id.size() > 0 && id.size() <= 128 && id.matches('^[a-zA-Z0-9_\\-]+$');
    }

    match /users/{userId}/conversations/{conversationId} {
      allow read, delete: if isOwner(userId) && isValidId(userId) && isValidId(conversationId);
      allow create: if isOwner(userId) && isValidId(userId) && isValidId(conversationId)
        && request.resource.data.userId == userId
        && request.resource.data.title is string
        && request.resource.data.title.size() <= 200;
      allow update: if isOwner(userId) && isValidId(userId) && isValidId(conversationId)
        && request.resource.data.userId == userId;

      match /messages/{messageId} {
        allow read, delete: if isOwner(userId) && isValidId(userId) && isValidId(conversationId) && isValidId(messageId);
        allow create: if isOwner(userId) && isValidId(userId) && isValidId(conversationId) && isValidId(messageId)
          && request.resource.data.userId == userId
          && request.resource.data.content is string
          && request.resource.data.content.size() <= 10000;
        allow update: if isOwner(userId) && isValidId(userId) && isValidId(conversationId) && isValidId(messageId)
          && request.resource.data.userId == userId;
      }
    }

    match /users/{userId}/insights/{insightId} {
      allow read, delete: if isOwner(userId) && isValidId(userId) && isValidId(insightId);
      allow create, update: if isOwner(userId) && isValidId(userId) && isValidId(insightId)
        && request.resource.data.userId == userId;
    }
  }
}
```

Deploy rules using the Firebase CLI:
```bash
firebase deploy --only firestore:rules
```

---

## 4. Google Cloud Run Deployment

Deploy the containerized full-stack application directly to Cloud Run, mounting the secret as an environment variable:

```bash
# Deploy to Google Cloud Run
gcloud run deploy echomind \
  --source . \
  --region $REGION \
  --platform managed \
  --allow-unauthenticated \
  --set-secrets="GEMINI_API_KEY=GEMINI_API_KEY:latest" \
  --port 3000
```

---

## 5. Mandatory Campaign Verification Labeling

Apply the mandatory verification resource label to register the service for automated challenge verification:

```bash
gcloud run services update echomind \
  --update-labels=dev-tutorial=cloud-run-ai-challenge \
  --region=$REGION
```

---

## 6. Local Development

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Provide GEMINI_API_KEY in .env

# 3. Start unified fullstack development server
npm run dev
```

---

## 7. Verification Test Suite Walkthrough

Click the **Verification Checklist** button in the navigation header to run through the interactive 7-domain test suite:
1. `AUTH-01 / AUTH-02`: Google Sign-In & Session Invalidation
2. `CONV-01 / CONV-02`: Multi-turn Conversational Memory & Session Synthesis
3. `DATA-01`: Zero-Crash Persistence & Undefined-Stripping
4. `ISOL-01`: Cryptographic Token Verification & Cross-User Path Isolation
5. `ERR-01`: Resilient Fallback Ladder & Input Buffer Preservation
6. `COMP-01`: Pattern Compass Longitudinal Privacy & Analysis
7. `PRIV-01`: Privacy Center Audit, Selective Deletion & Full Vault Purge
