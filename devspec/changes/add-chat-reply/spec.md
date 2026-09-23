# Spec: add-chat-reply

### Requirement: reply link persistence [req-1]
The API SHALL persist an optional reference from a message to the message it replies to, and return null when a message is not a reply.

#### Scenario: send a reply
- **WHEN** a message is sent with a `replyToId` naming a message in the same conversation
- **THEN** the created message is stored with that `replyToId`

#### Scenario: send a normal message
- **WHEN** a message is sent with no `replyToId`
- **THEN** the created message stores `replyToId` as null

### Requirement: same-conversation guard [req-2]
The API SHALL reject a reply whose target message is not in the same conversation.

#### Scenario: cross-conversation reply
- **WHEN** a message is sent with a `replyToId` that belongs to a different conversation
- **THEN** the API rejects the send with a 400 (bad request) and stores nothing

### Requirement: reply preview on read [req-3]
The API SHALL include a shallow preview of the parent message (id, body, deletedAt, author) on every message that is a reply, across message creation broadcast, history fetch, and edit broadcast.

#### Scenario: reply appears in history
- **WHEN** a conversation's messages are fetched and one is a reply
- **THEN** that message carries a `replyTo` object with the parent's id, body, deletedAt, and author

#### Scenario: reply broadcast on send
- **WHEN** a reply is sent and broadcast to the conversation room
- **THEN** the broadcast payload carries the `replyTo` preview

### Requirement: deleted parent preview [req-4]
The system SHALL show a reply to a soft-deleted message as "message deleted" and never expose the deleted parent's body.

#### Scenario: parent soft-deleted
- **WHEN** a reply's parent has `deletedAt` set
- **THEN** the quoted preview shows "message deleted" and not the parent's original text

### Requirement: reply action in the thread [req-5]
The web UI SHALL let a user start a reply from any message (own or others', DM or channel) via the message hover toolbar, showing a cancelable banner in the composer.

#### Scenario: start a reply
- **WHEN** the user clicks Reply on a message
- **THEN** the composer shows a "Replying to <name>: <preview>" banner and the next send carries that message's id as `replyToId`

#### Scenario: cancel a reply
- **WHEN** the user clicks the banner's ✕ or presses Escape
- **THEN** the banner clears and the next send carries no `replyToId`

#### Scenario: reply clears after send
- **WHEN** the user sends a message while a reply banner is active
- **THEN** the message sends with the `replyToId` and the banner clears

### Requirement: quoted parent render [req-6]
The web UI SHALL render a reply's parent as a compact quoted preview above the reply's body, showing the parent author and a one-line truncated body.

#### Scenario: reply renders with quote
- **WHEN** a message with a `replyTo` preview is displayed
- **THEN** a quoted block above its body shows the parent author name and a single-line truncated parent body

### Requirement: jump to original [req-7]
The web UI SHALL scroll to and briefly highlight the original message when the user clicks a reply's quoted preview, when the original is in the loaded message list.

#### Scenario: original is loaded
- **WHEN** the user clicks a quoted preview whose original message is currently rendered
- **THEN** the view scrolls to the original and flashes a transient highlight on it

#### Scenario: original not loaded
- **WHEN** the user clicks a quoted preview whose original is not in the loaded page
- **THEN** the view does not jump and does not error (no-op or a brief "not loaded" notice)
