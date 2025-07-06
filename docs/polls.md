# Poll Feature Implementation

This document describes the poll feature implementation for posting notes with polls.

## API Usage

### Creating a Note with a Poll

To create a note with a poll, include the following parameters in your POST request to `/api/v1/statuses`:

```json
{
  "status": "Which do you prefer?",
  "poll[options]": ["Option 1", "Option 2", "Option 3"],
  "poll[expires_in]": 3600,
  "poll[multiple]": false,
  "poll[hide_totals]": false
}
```

### Parameters

- `poll[options]`: Array of poll option strings (2-20 options, max 500 chars each)
- `poll[expires_in]`: Duration in seconds (60 seconds to 100 days)
- `poll[multiple]`: Boolean, allow multiple choice selection (optional, default: false)
- `poll[hide_totals]`: Boolean, hide vote counts until poll ends (optional, default: false)

### Constraints

- Polls cannot be attached to posts with media attachments
- Minimum 2 options required
- Maximum options and duration are configurable in server settings

## API Response

When fetching a note with a poll, the response includes:

```json
{
  "id": "note-id",
  "content": "Which do you prefer?",
  "poll": {
    "id": "poll-id",
    "expires_at": "2025-01-07T14:11:00.000Z",
    "expired": false,
    "multiple": false,
    "votes_count": 6,
    "voters_count": 3,
    "options": [
      {
        "title": "Option 1",
        "votes_count": 4
      },
      {
        "title": "Option 2", 
        "votes_count": 2
      }
    ],
    "emojis": [],
    "voted": true,
    "own_votes": [0]
  }
}
```

## Database Schema

The implementation adds three new tables:

### Polls
- `id`: Primary key
- `noteId`: Foreign key to Notes table (unique)
- `expiresAt`: Poll expiration timestamp (nullable)
- `multiple`: Allow multiple choice
- `hideTotals`: Hide vote counts until expired
- `votesCount`: Total vote count
- `votersCount`: Unique voter count

### PollOptions
- `id`: Primary key
- `pollId`: Foreign key to Polls table
- `title`: Option text
- `index`: Option position (0-based)
- `votesCount`: Votes for this option

### PollVotes
- `id`: Primary key
- `pollId`: Foreign key to Polls table
- `optionId`: Foreign key to PollOptions table
- `userId`: Foreign key to Users table
- Unique constraint on (pollId, userId, optionId)

## Implementation Details

- Polls are created atomically with the note in a database transaction
- Poll data is included in note queries via relations
- Expiration is checked dynamically when converting to API format
- Vote totals can be hidden until poll expires based on `hideTotals` setting
- User vote status and choices are included when user context is available