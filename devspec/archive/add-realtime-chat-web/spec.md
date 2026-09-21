# Spec: add-realtime-chat-web (frontend)

### Requirement: chat access in the app shell [req-1]
The web app SHALL expose a Chat entry in the existing sidebar that navigates to `/chat` and shows a total-unread badge separate from the notification bell.

#### Scenario: open chat
- **WHEN** a signed-in user clicks the Chat item in `AppSidebar`
- **THEN** the app navigates to `/chat` and renders the chat page in the main area

#### Scenario: unread badge
- **WHEN** the user has unread chat messages
- **THEN** the Chat sidebar item shows a badge with the total unread count, independent of the notification bell

### Requirement: conversation list [req-2]
The chat page SHALL list the user's conversations split into Channels and Direct Messages, each entry showing unread count, and DMs showing the peer's presence.

#### Scenario: grouped list
- **WHEN** the chat page loads with conversations
- **THEN** channels appear under a Channels group and DMs under a Direct Messages group, each with its unread count

#### Scenario: empty
- **WHEN** the user has no conversations
- **THEN** an empty state invites starting a DM or creating a channel

### Requirement: new-conversation overlay [req-3]
The chat page SHALL open an overlay to search all people and channels — including those never messaged — and start a DM, open/join a channel, or create a channel.

#### Scenario: search people
- **WHEN** the user types a name in the overlay
- **THEN** matching people appear with a Message action that opens or creates a DM with them

#### Scenario: join a channel
- **WHEN** the user picks a channel they have not joined
- **THEN** a Join action adds them and opens it

#### Scenario: no match
- **WHEN** the query matches nothing
- **THEN** a no-match state offers to create a channel named after the query

### Requirement: message thread rendering [req-4]
The thread SHALL render messages newest-at-bottom, merging consecutive same-author messages into one group, and marking edited and deleted messages.

#### Scenario: grouped run
- **WHEN** one author sends several consecutive messages
- **THEN** the avatar and name render once and the bubbles stack under it

#### Scenario: edited and deleted
- **WHEN** a message is edited or soft-deleted
- **THEN** it shows an "edited" marker, or a "message deleted" placeholder with no body

### Requirement: send and receive live [req-5]
The composer SHALL send a message optimistically and the thread SHALL show messages from others in real time over the `/chat` socket.

#### Scenario: optimistic send
- **WHEN** the user sends a message
- **THEN** it appears immediately in a sending state and reconciles when the server echo arrives

#### Scenario: live receive
- **WHEN** another member sends a message to the open conversation
- **THEN** it appears in the thread without a manual refresh

#### Scenario: send failure
- **WHEN** a send fails
- **THEN** the bubble shows a failed state with a retry, and the draft is preserved

### Requirement: history infinite scroll [req-6]
The thread SHALL load older messages by cursor as the user scrolls up.

#### Scenario: load older
- **WHEN** the user scrolls to the top of the thread
- **THEN** the previous page of older messages loads and prepends without losing scroll position

### Requirement: edit and delete own message [req-7]
The user SHALL edit or delete their own messages from the thread.

#### Scenario: edit
- **WHEN** the user edits their message and confirms
- **THEN** the bubble updates and shows the edited marker

#### Scenario: delete
- **WHEN** the user deletes their message
- **THEN** it renders as the deleted placeholder

### Requirement: attachments [req-8]
The composer SHALL attach files by button, paste, or drag-and-drop; images SHALL render inline with a copy action, and non-image files SHALL render as a download chip.

#### Scenario: paste image
- **WHEN** the user pastes an image into the composer
- **THEN** it is attached and, on send, uploaded and rendered inline in the thread

#### Scenario: copy inline image
- **WHEN** the user uses the copy action on an inline image
- **THEN** the image is written to the clipboard

#### Scenario: non-image file
- **WHEN** a message carries a non-image file
- **THEN** it renders as a download chip, not inline

### Requirement: typing indicator [req-9]
The composer SHALL emit typing and the thread SHALL show when another member is typing.

#### Scenario: show typing
- **WHEN** another member is typing in the open conversation
- **THEN** a typing indicator shows and clears when they stop

### Requirement: presence [req-10]
DM entries and the thread header SHALL reflect the peer's online presence live.

#### Scenario: presence updates
- **WHEN** a peer goes online or offline
- **THEN** their presence dot updates without a refresh

### Requirement: read state [req-11]
Opening a conversation SHALL mark it read and clear its unread badge; the sender SHALL see read receipts.

#### Scenario: mark read on open
- **WHEN** the user opens a conversation with unread messages
- **THEN** its unread count clears and the read state is sent

#### Scenario: read receipt
- **WHEN** the recipient has read the user's message
- **THEN** the user's message shows a read indicator

### Requirement: chat socket lifecycle [req-12]
The web app SHALL connect a `/chat` namespace socket authenticated with the Keycloak token and re-authenticate on token refresh.

#### Scenario: connect
- **WHEN** the chat page is active and the user is authenticated
- **THEN** a `/chat` socket connects and receives events

#### Scenario: token refresh
- **WHEN** the Keycloak token refreshes
- **THEN** the chat socket reconnects with the new token
