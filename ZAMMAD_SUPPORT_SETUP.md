# Zammad Support Integration - Setup Guide

This document explains how to set up and use the Zammad Support integration for LibreChat.

## Overview

The Zammad Support integration adds a "Support" menu item to the LibreChat user interface, allowing logged-in users to submit support requests directly to your Zammad ticketing system.

## Features

- **User-friendly Support Form**: Clean, integrated form matching LibreChat's design system
- **Categorized Requests**: Users can categorize issues (Bug Report, Feature Request, Question, Technical Issue)
- **Priority Levels**: Support for Low, Normal, and High priority tickets
- **Auto-populated User Info**: Tickets automatically include user details (name, email, user ID)
- **Success/Error Feedback**: Toast notifications and inline messages for submission status
- **Secure API Integration**: Token-based authentication with Zammad API

## Installation

### Prerequisites

1. A working Zammad instance (self-hosted or cloud)
2. Admin access to your Zammad instance
3. A running LibreChat instance

### Step 1: Generate Zammad API Token

1. Log in to your Zammad instance as an administrator
2. Navigate to **Admin → Channels → API**
3. Click **Create** to generate a new API token
4. **Important**: Copy the token immediately - it won't be shown again
5. Give it a descriptive name like "LibreChat Support Integration"

### Step 2: Configure Environment Variables

Add the following environment variables to your `.env` file:

```bash
# Zammad Support Configuration
ZAMMAD_URL=https://your-zammad-instance.com
ZAMMAD_API_TOKEN=your_api_token_here
ZAMMAD_GROUP=Users
```

**Configuration Details:**

- **ZAMMAD_URL**: Your Zammad instance URL (without trailing slash)
  - Example: `https://support.yourcompany.com`
  - For self-hosted: `http://localhost:3000` or your domain

- **ZAMMAD_API_TOKEN**: The API token generated in Step 1
  - Keep this secure - treat it like a password
  - Never commit this to version control

- **ZAMMAD_GROUP**: The Zammad group to assign tickets to (default: "Users")
  - This group must exist in your Zammad instance
  - Common options: "Users", "Support", "1st Level", "2nd Level"

### Step 3: Verify Zammad Group Exists

1. In Zammad, go to **Admin → Groups**
2. Ensure the group specified in `ZAMMAD_GROUP` exists
3. If not, create it or use an existing group name

### Step 4: Restart LibreChat

After configuring the environment variables:

```bash
# If using Docker
docker-compose restart

# If running locally
npm run backend  # Restart the backend server
```

## Usage

### For End Users

1. **Log in** to LibreChat
2. Click your **user avatar** in the bottom-left corner
3. Select **Support** from the menu
4. Fill out the support form:
   - **Subject**: Brief description of your issue (required, max 128 chars)
   - **Category**: Select from Bug Report, Feature Request, Question, or Technical Issue (required)
   - **Priority**: Choose Low, Normal, or High (required)
   - **Description**: Detailed description of your issue (required, max 2000 chars)
5. Click **Submit Request**
6. You'll receive a confirmation message with the ticket number

### What Happens After Submission

1. A ticket is created in Zammad with:
   - **Title**: `[CATEGORY] Subject`
   - **Customer**: The user's email address
   - **Priority**: Selected priority level
   - **Group**: The configured support group
   - **Article Body**: Includes the description plus user information

2. The user receives confirmation in LibreChat
3. Support staff can view and respond to the ticket in Zammad
4. Email notifications are handled by Zammad's normal workflow

## File Structure

The integration consists of the following new/modified files:

### Frontend Files

```
client/src/
├── components/Nav/
│   ├── SupportModal.tsx          # Main support form modal component
│   └── AccountSettings.tsx        # Modified to add Support menu item
├── data-provider/
│   └── Support/
│       ├── mutations.ts           # React Query mutation hook
│       └── index.ts               # Export file
├── store/
│   └── settings.ts                # Modified to add showSupport atom
└── locales/en/
    └── translation.json           # Modified with support translations
```

### Backend Files

```
api/server/routes/
├── support.js                     # Support API endpoint
└── index.js                       # Modified to register support route
```

### Configuration Files

```
packages/data-provider/src/
├── api-endpoints.ts               # Modified to add support endpoint
├── data-service.ts                # Modified to add submitSupportRequest
└── keys.ts                        # Modified to add submitSupportRequest mutation key

.env.example                       # Updated with Zammad config section
```

## API Reference

### POST /api/support

Submit a support request to Zammad.

**Authentication**: Required (JWT)

**Request Body:**
```json
{
  "subject": "Cannot upload files",
  "category": "technical",
  "priority": "high",
  "description": "Detailed description of the issue..."
}
```

**Success Response (200):**
```json
{
  "success": true,
  "ticketId": 123,
  "ticketNumber": "100456",
  "message": "Support request submitted successfully"
}
```

**Error Response (500):**
```json
{
  "success": false,
  "message": "Error submitting support request",
  "error": "Error details..."
}
```

## Translation Keys

All UI text is internationalized. To add translations for other languages, add the following keys to your locale files:

```json
{
  "com_nav_support": "Support",
  "com_nav_support_title": "Contact Support",
  "com_nav_support_description": "Submit a support request...",
  "com_nav_support_subject": "Subject",
  "com_nav_support_subject_placeholder": "Brief description...",
  "com_nav_support_category": "Category",
  "com_nav_support_category_bug": "Bug Report",
  "com_nav_support_category_feature": "Feature Request",
  "com_nav_support_category_question": "Question",
  "com_nav_support_category_technical": "Technical Issue",
  "com_nav_support_priority": "Priority",
  "com_nav_support_priority_low": "Low",
  "com_nav_support_priority_normal": "Normal",
  "com_nav_support_priority_high": "High",
  "com_nav_support_description": "Description",
  "com_nav_support_description_placeholder": "Detailed information...",
  "com_nav_support_submit": "Submit Request",
  "com_nav_support_submitting": "Submitting...",
  "com_nav_support_success": "Support request submitted successfully!",
  "com_nav_support_success_message": "Our team will get back to you shortly.",
  "com_nav_support_error": "Failed to submit support request",
  "com_nav_support_error_message": "Please try again.",
  "com_nav_support_field_required": "This field is required",
  "com_nav_support_subject_max_length": "Max 128 characters",
  "com_nav_support_description_max_length": "Max 2000 characters"
}
```

## Troubleshooting

### Issue: "Support system is not configured" error

**Solution**: Verify that `ZAMMAD_URL` and `ZAMMAD_API_TOKEN` are set in your `.env` file and restart the backend.

### Issue: "Cannot connect to support system" error

**Solution**:
- Check that your Zammad instance is running and accessible
- Verify the `ZAMMAD_URL` is correct
- Check firewall/network settings if Zammad is on a different server
- Ensure SSL certificates are valid if using HTTPS

### Issue: 401/403 errors from Zammad

**Solution**:
- Verify the API token is correct
- Ensure the API token has not expired
- Check that API access is enabled in Zammad

### Issue: Tickets created but assigned to wrong group

**Solution**:
- Check that `ZAMMAD_GROUP` matches an existing group name in Zammad (case-sensitive)
- Verify the group name in Zammad Admin → Groups

### Issue: User email not found in Zammad

**Solution**:
- Zammad will automatically create a new customer if the email doesn't exist
- Ensure the user has a valid email address in LibreChat

## Security Considerations

1. **Keep API Token Secure**: Never expose the `ZAMMAD_API_TOKEN` in client-side code or commit it to version control
2. **Use HTTPS**: Always use HTTPS for your Zammad instance in production
3. **Authentication Required**: The support endpoint requires JWT authentication - only logged-in users can submit requests
4. **Rate Limiting**: Consider implementing rate limiting on the `/api/support` endpoint to prevent abuse
5. **Input Validation**: The API validates all input fields before sending to Zammad

## Customization

### Changing Form Fields

To modify the support form:

1. Edit `/root/intra-ai/user-interface/client/src/components/Nav/SupportModal.tsx`
2. Update the form schema in the `useForm` hook
3. Add/modify form fields in the JSX
4. Update validation rules in the `register` calls

### Changing Categories or Priorities

Edit the `categoryOptions` and `priorityOptions` arrays in `SupportModal.tsx`:

```typescript
const categoryOptions = [
  { value: 'bug', labelKey: 'com_nav_support_category_bug' },
  // Add more options here
];
```

Don't forget to add corresponding translation keys!

### Custom Ticket Format

Modify the ticket payload in `/root/intra-ai/user-interface/api/server/routes/support.js`:

```javascript
const zammadPayload = {
  title: `[${category.toUpperCase()}] ${subject}`,
  group: zammadGroup,
  customer: user.email,
  priority: priorityMap[priority] || '2 normal',
  article: {
    subject: subject,
    body: articleBody,
    type: 'web',
    internal: false,
  },
  // Add custom fields here
};
```

## Support

If you encounter issues with this integration:

1. Check the LibreChat backend logs for errors
2. Check the Zammad logs for API errors
3. Verify all environment variables are set correctly
4. Test the Zammad API directly using curl:

```bash
curl -H "Authorization: Token token=YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -X POST \
     -d '{"title":"Test","group":"Users","customer":"user@example.com","article":{"subject":"Test","body":"Test ticket","type":"web"}}' \
     https://your-zammad-instance.com/api/v1/tickets
```

## License

This integration follows the same license as LibreChat.
