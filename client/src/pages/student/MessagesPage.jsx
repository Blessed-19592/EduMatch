import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import {
  faArrowLeft,
  faPaperPlane,
  faComments,
  faUsers,
  faCircle,
  faRotate,
  faPaperclip,
  faFile,
  faXmark,
  faSpinner,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import api, { getApiErrorMessage } from '../../api/api';
import ImageAvatar from '../../components/ImageAvatar';
import { useAuth } from '../../context/AuthContext';
import './MessagesPage.css';

const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;
const MAX_ATTACHMENTS = 5;
const ACCEPTED_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.webp', '.pdf', '.docx', '.xlsx', '.pptx'
]);

const getSocketUrl = () => {
  const configuredUrl = import.meta.env.VITE_SOCKET_URL;

  if (import.meta.env.DEV) {
    const configuredPort = configuredUrl ? new URL(configuredUrl).port : '';
    const port = configuredPort || '5000';
    return `${window.location.protocol}//${window.location.hostname}:${port}`;
  }

  return configuredUrl || window.location.origin;
};

const SOCKET_URL = getSocketUrl();

const formatFileSize = (size) => {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const getFileExtension = (fileName) => {
  const dotIndex = fileName.lastIndexOf('.');
  return dotIndex >= 0 ? fileName.slice(dotIndex).toLowerCase() : '';
};

const getAttachmentUrl = (groupId, attachmentId) =>
  `/api/groups/${encodeURIComponent(groupId)}/chat-attachments/${encodeURIComponent(attachmentId)}`;

const formatMessageTime = (date) => {
  if (!date) return '';

  return new Date(date).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatMessageDate = (date) => {
  if (!date) return '';

  const messageDate = new Date(date);
  const today = new Date();

  if (messageDate.toDateString() === today.toDateString()) {
    return 'Today';
  }

  return messageDate.toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

function MessagesPage() {
  const { user } = useAuth();
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState('');

  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);

  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [error, setError] = useState('');
  const [mobileChatOpen, setMobileChatOpen] = useState(false);

  const socketRef = useRef(null);
  const selectedGroupRef = useRef(null);
  const chatMessagesRef = useRef(null);
  const fileInputRef = useRef(null);
  const objectUrlsRef = useRef(new Set());

  useEffect(() => () => {
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    objectUrlsRef.current.clear();
  }, []);

  // Load groups the student belongs to.
  const loadGroups = useCallback(async () => {
    try {
      setLoadingGroups(true);
      setError('');

      const response = await api.get('/groups/my-groups');

      const fetchedGroups = response.data.groups || [];

      setGroups(fetchedGroups);

      const currentGroup = selectedGroupRef.current;
      const refreshedGroup = currentGroup
        ? fetchedGroups.find(
            (group) => group.group_id === currentGroup.group_id
          ) || null
        : null;

      selectedGroupRef.current = refreshedGroup;
      setSelectedGroup(refreshedGroup);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoadingGroups(false);
    }
  }, []);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  // Add a message without creating duplicates.
  const addMessage = useCallback((newMessage) => {
    if (!newMessage?.message_id) return;

    setMessages((previous) => {
      const alreadyExists = previous.some(
        (message) => message.message_id === newMessage.message_id
      );

      if (alreadyExists) return previous;

      return [...previous, newMessage].sort(
        (a, b) =>
          new Date(a.created_at).getTime() -
          new Date(b.created_at).getTime()
      );
    });
  }, []);

  const releasePreview = (attachment) => {
    if (!attachment.previewUrl) return;
    URL.revokeObjectURL(attachment.previewUrl);
    objectUrlsRef.current.delete(attachment.previewUrl);
  };

  const removePendingUpload = async (groupId, attachmentId) => {
    try {
      await api.delete(
        `/groups/${groupId}/chat-attachments/${attachmentId}`
      );
    } catch (requestError) {
      console.error('Unable to remove a pending chat attachment:', requestError);
      setError(
        'An unused upload could not be removed. It will expire automatically.'
      );
    }
  };

  const handleFilesSelected = (event) => {
    const files = Array.from(event.target.files || []);
    const accepted = [];
    const rejected = [];
    let remaining = MAX_ATTACHMENTS - selectedFiles.length;

    for (const file of files) {
      if (remaining <= 0) {
        rejected.push('A message can include up to 5 files.');
        break;
      }

      if (file.size === 0 || file.size > MAX_ATTACHMENT_SIZE) {
        rejected.push(`${file.name} must be smaller than or equal to 10 MB.`);
        continue;
      }

      if (!ACCEPTED_EXTENSIONS.has(getFileExtension(file.name))) {
        rejected.push(`${file.name} is not a supported file type.`);
        continue;
      }

      const previewUrl = file.type.startsWith('image/')
        ? URL.createObjectURL(file)
        : '';

      if (previewUrl) objectUrlsRef.current.add(previewUrl);

      accepted.push({
        key: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`,
        file,
        previewUrl,
        attachmentId: null
      });
      remaining -= 1;
    }

    if (accepted.length > 0) {
      setSelectedFiles((previous) => [...previous, ...accepted]);
    }

    setError(rejected.join(' '));
    event.target.value = '';
  };

  const handleRemoveFile = async (attachment) => {
    if (attachment.attachmentId && selectedGroup) {
      await removePendingUpload(
        selectedGroup.group_id,
        attachment.attachmentId
      );
    }

    releasePreview(attachment);
    setSelectedFiles((previous) =>
      previous.filter((file) => file.key !== attachment.key)
    );
  };

  const joinGroupChat = useCallback((socket, groupId) => {
    setLoadingMessages(true);
    setMessages([]);
    setError('');

    socket.emit('group:join', { groupId }, (joinResponse) => {
      if (!joinResponse || joinResponse.status !== 'success') {
        setLoadingMessages(false);
        setError(
          joinResponse?.message ||
            'Unable to access this group chat.'
        );
        return;
      }

      socket.emit(
        'group:history',
        {
          groupId,
          limit: 50,
        },
        (historyResponse) => {
          setLoadingMessages(false);

          if (
            !historyResponse ||
            historyResponse.status !== 'success'
          ) {
            setError(
              historyResponse?.message ||
                'Unable to load chat history.'
            );
            return;
          }

          setMessages(historyResponse.messages || []);
        }
      );
    });
  }, []);

  // Establish the authenticated Socket.IO connection.
  useEffect(() => {
    const socket = io(SOCKET_URL, {
      withCredentials: true,
      reconnection: true,
      timeout: 8000,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 3000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnectionStatus('connected');
      setError('');

      const currentGroup = selectedGroupRef.current;

      if (currentGroup) {
        joinGroupChat(socket, currentGroup.group_id);
      }
    });

    socket.on('disconnect', () => {
      setConnectionStatus('disconnected');
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection failed:', error.message);
      setConnectionStatus('disconnected');
      setError('Messaging is temporarily unavailable. Reconnecting…');
    });

    socket.on('group:new-message', (message) => {
      const currentGroup = selectedGroupRef.current;

      if (
        currentGroup &&
        message.group_id === currentGroup.group_id
      ) {
        addMessage(message);
      }
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [addMessage, joinGroupChat]);

  // Select a group conversation.
  const handleSelectGroup = async (group) => {
    if (sending) return;

    const previousGroupId = selectedGroup?.group_id;
    const unusedUploads = selectedFiles.filter((file) => file.attachmentId);

    if (previousGroupId && unusedUploads.length > 0) {
      await Promise.all(
        unusedUploads.map((file) =>
          removePendingUpload(previousGroupId, file.attachmentId)
        )
      );
    }

    selectedFiles.forEach(releasePreview);
    setSelectedFiles([]);
    setSelectedGroup(group);
    selectedGroupRef.current = group;

    setMessages([]);
    setMessageInput('');
    setError('');
    setMobileChatOpen(true);

    const socket = socketRef.current;

    if (socket?.connected) {
      joinGroupChat(socket, group.group_id);
    } else {
      setConnectionStatus('connecting');
    }
  };

  // Send a message.
  const handleSendMessage = async (event) => {
    event.preventDefault();

    const content = messageInput.trim();
    const socket = socketRef.current;

    if ((!content && selectedFiles.length === 0) || !selectedGroup || sending) return;

    if (!socket?.connected) {
      setError('You are disconnected. Reconnecting…');
      return;
    }

    if (content.length > 5000) {
      setError('Messages cannot exceed 5,000 characters.');
      return;
    }

    setSending(true);
    setError('');

    try {
      const attachmentIds = [];

      for (let index = 0; index < selectedFiles.length; index += 1) {
        const attachment = selectedFiles[index];
        let attachmentId = attachment.attachmentId;

        if (!attachmentId) {
          setUploadProgress(`Uploading file ${index + 1} of ${selectedFiles.length}…`);
          const params = new URLSearchParams({
            name: attachment.file.name,
            type: attachment.file.type
          });
          const uploadResponse = await api.post(
            `/groups/${selectedGroup.group_id}/chat-attachments?${params.toString()}`,
            attachment.file,
            { headers: { 'Content-Type': 'application/octet-stream' } }
          );

          attachmentId =
            uploadResponse.data?.data?.attachment?.attachment_id;

          if (!attachmentId) {
            throw new Error('The server did not confirm the uploaded file.');
          }

          setSelectedFiles((previous) =>
            previous.map((file) =>
              file.key === attachment.key
                ? { ...file, attachmentId }
                : file
            )
          );
        }

        attachmentIds.push(attachmentId);
      }

      setUploadProgress('Sending message…');
      const response = await new Promise((resolve, reject) => {
        socket.timeout(15000).emit(
          'group:message',
          {
            groupId: selectedGroup.group_id,
            messageContent: content,
            attachmentIds
          },
          (timeoutError, acknowledgement) => {
            if (timeoutError) {
              reject(new Error('The message timed out. Please try again.'));
            } else if (acknowledgement?.status !== 'success') {
              reject(new Error(
                acknowledgement?.message || 'Your message could not be sent.'
              ));
            } else {
              resolve(acknowledgement);
            }
          }
        );
      });

      if (response.message) addMessage(response.message);
      selectedFiles.forEach(releasePreview);
      setSelectedFiles([]);
      setMessageInput('');
    } catch (requestError) {
      setError(
        requestError.response
          ? getApiErrorMessage(requestError)
          : requestError.message || 'Your message could not be sent.'
      );
    } finally {
      setSending(false);
      setUploadProgress('');
    }
  };

  // Scroll only the chat messages area to the latest message.
  useEffect(() => {
    const chatContainer = chatMessagesRef.current;

    if (chatContainer) {
      chatContainer.scrollTo({
        top: chatContainer.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages]);

  const handleBackToGroups = () => {
    setMobileChatOpen(false);
  };

  const groupedMessages = messages.reduce((result, message) => {
    const date = formatMessageDate(message.created_at);

    if (!result[date]) {
      result[date] = [];
    }

    result[date].push(message);

    return result;
  }, {});

  const renderAttachment = (attachment) => {
    const url = getAttachmentUrl(
      selectedGroup.group_id,
      attachment.attachment_id
    );

    if (attachment.mime_type?.startsWith('image/')) {
      return (
        <a
          className="chat-image-attachment"
          href={url}
          target="_blank"
          rel="noreferrer"
          key={attachment.attachment_id}
        >
          <img
            src={url}
            alt={attachment.original_filename}
            loading="lazy"
          />
          <span>{attachment.original_filename}</span>
        </a>
      );
    }

    return (
      <a
        className="chat-file-attachment"
        href={url}
        target="_blank"
        rel="noreferrer"
        key={attachment.attachment_id}
      >
        <FontAwesomeIcon icon={faFile} />
        <span>
          <strong>{attachment.original_filename}</strong>
          <small>{formatFileSize(Number(attachment.size_bytes) || 0)}</small>
        </span>
      </a>
    );
  };

  return (
    <div className="messages-page">
      <div className="messages-heading">
        <div>
          <h1>Messages</h1>

          <p>
            Communicate and collaborate with your group members.
          </p>
        </div>

        <button
          type="button"
          className="messages-refresh"
          onClick={loadGroups}
          disabled={loadingGroups}
          aria-label="Refresh groups"
        >
          <FontAwesomeIcon icon={faRotate} />
        </button>
      </div>

      <div className="messages-layout">
        {/* GROUP CONVERSATIONS */}
        <aside
          className={`messages-sidebar ${
            mobileChatOpen ? 'mobile-hidden' : ''
          }`}
        >
          <div className="messages-sidebar-heading">
            <div>
              <h2>Conversations</h2>
              <span>{groups.length} groups</span>
            </div>
            <span className={`messages-live-status ${connectionStatus}`} role="status" aria-live="polite">
              <FontAwesomeIcon icon={faCircle} />
              {connectionStatus === 'connected'
                ? 'Online'
                : connectionStatus === 'connecting'
                ? 'Connecting'
                : 'Reconnecting'}
            </span>
          </div>

          {loadingGroups ? (
            <div className="messages-list-state">
              Loading conversations...
            </div>
          ) : groups.length === 0 ? (
            <div className="messages-list-empty">
              <FontAwesomeIcon icon={faUsers} />

              <h3>No conversations yet</h3>

              <p>
                Join or create a group to start communicating.
              </p>
            </div>
          ) : (
            <div className="conversation-list">
              {groups.map((group) => (
                <button
                  type="button"
                  key={group.group_id}
                  className={`conversation-item ${
                    selectedGroup?.group_id === group.group_id
                      ? 'active'
                      : ''
                  }`}
                  onClick={() => handleSelectGroup(group)}
                  disabled={sending}
                  aria-current={selectedGroup?.group_id === group.group_id ? 'true' : undefined}
                >
                  <ImageAvatar
                    src={group.group_picture_url}
                    name={group.group_name}
                    className="conversation-avatar"
                    fallback={<FontAwesomeIcon icon={faUsers} />}
                  />

                  <div className="conversation-details">
                    <h3>{group.group_name}</h3>

                    <p>
                      {group.intention_name || 'Group conversation'}
                    </p>

                    <span>
                      {group.current_members || 0} members
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </aside>

        {/* CHAT WINDOW */}
        <section
          className={`messages-chat ${
            mobileChatOpen ? 'mobile-visible' : ''
          }`}
        >
          {!selectedGroup ? (
            <div className="messages-welcome">
              <div className="messages-welcome-icon">
                <FontAwesomeIcon icon={faComments} />
              </div>

              <h2>Your conversations</h2>

              <p>
                Select a group to view its messages and communicate
                with its members.
              </p>
            </div>
          ) : (
            <>
              {/* CHAT HEADER */}
              <header className="chat-header">
                <button
                  type="button"
                  className="chat-back-button"
                  onClick={handleBackToGroups}
                  aria-label="Back to conversations"
                >
                  <FontAwesomeIcon icon={faArrowLeft} />
                </button>

                <ImageAvatar
                  src={selectedGroup.group_picture_url}
                  name={selectedGroup.group_name}
                  className="chat-group-avatar"
                  fallback={<FontAwesomeIcon icon={faUsers} />}
                />

                <div className="chat-group-info">
                  <h2>{selectedGroup.group_name}</h2>

                  <p>
                    {selectedGroup.current_members || 0} members
                  </p>
                </div>

                <div
                  className={`chat-connection ${
                    connectionStatus
                  }`}
                >
                  <FontAwesomeIcon icon={faCircle} />

                  <span>
                    {connectionStatus === 'connected'
                      ? 'Connected'
                      : connectionStatus === 'connecting'
                      ? 'Connecting'
                      : 'Reconnecting'}
                  </span>
                </div>
              </header>

              {/* MESSAGES */}
              <div className="chat-messages" ref={chatMessagesRef}>
                {loadingMessages ? (
                  <div className="chat-state">
                    Loading messages...
                  </div>
                ) : messages.length === 0 ? (
                  <div className="chat-empty">
                    <FontAwesomeIcon icon={faComments} />

                    <h3>Start the conversation</h3>

                    <p>
                      Send the first message to your group.
                    </p>
                  </div>
                ) : (
                  Object.entries(groupedMessages).map(
                    ([date, dateMessages]) => (
                      <div key={date}>
                        <div className="chat-date-divider">
                          <span>{date}</span>
                        </div>

                        {dateMessages.map((message) => (
                          <div
                            key={message.message_id}
                            className={`chat-message-row ${
                              String(message.sender_id) === String(user?.userId)
                                ? 'own'
                                : ''
                            }`}
                          >
                            <div className="chat-message-avatar">
                              {(message.sender_name || '?')
                                .charAt(0)
                                .toUpperCase()}
                            </div>

                            <div className="chat-message-content">
                              <div className="chat-message-meta">
                                <strong>
                                  {String(message.sender_id) === String(user?.userId)
                                    ? 'You'
                                    : message.sender_name ||
                                    'Group member'}
                                </strong>

                                <span>
                                  {formatMessageTime(
                                    message.created_at
                                  )}
                                </span>
                              </div>

                              {message.message_content && (
                                <div className="chat-message-bubble">
                                  {message.message_content}
                                </div>
                              )}
                              {message.attachments?.length > 0 && (
                                <div className="chat-message-attachments">
                                  {message.attachments.map(renderAttachment)}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  )
                )}

                
              </div>

              {/* MESSAGE COMPOSER */}
              <form
                className="chat-composer"
                onSubmit={handleSendMessage}
              >
                {error && (
                  <div className="chat-error" role="alert">
                    {error}
                  </div>
                )}

                {selectedFiles.length > 0 && (
                  <div className="chat-pending-attachments" aria-label="Attachments to send">
                    {selectedFiles.map((attachment) => (
                      <div className="chat-pending-file" key={attachment.key}>
                        {attachment.previewUrl ? (
                          <img src={attachment.previewUrl} alt="" />
                        ) : (
                          <FontAwesomeIcon icon={faFile} />
                        )}
                        <span className="chat-pending-file-details">
                          <strong>{attachment.file.name}</strong>
                          <small>
                            {formatFileSize(attachment.file.size)}
                            {attachment.attachmentId ? ' · Uploaded' : ''}
                          </small>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveFile(attachment)}
                          disabled={sending}
                          aria-label={`Remove ${attachment.file.name}`}
                        >
                          <FontAwesomeIcon icon={faXmark} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  className="chat-file-input"
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,.pdf,.docx,.xlsx,.pptx"
                  multiple
                  onChange={handleFilesSelected}
                  aria-label="Choose up to 5 attachments, 10 MB each"
                />

                <div className="chat-input-wrapper">
                  <button
                    type="button"
                    className="chat-attach-button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={sending || selectedFiles.length >= MAX_ATTACHMENTS}
                    aria-label="Attach files"
                    title="Attach up to 5 files (10 MB each)"
                  >
                    <FontAwesomeIcon icon={faPaperclip} />
                  </button>

                  <textarea
                    value={messageInput}
                    disabled={sending}
                    onChange={(event) =>
                      setMessageInput(event.target.value)
                    }
                    onKeyDown={(event) => {
                      if (
                        event.key === 'Enter' &&
                        !event.shiftKey
                      ) {
                        event.preventDefault();
                        handleSendMessage(event);
                      }
                    }}
                    placeholder="Write a message..."
                    maxLength={5000}
                    rows={1}
                    aria-label="Write a message"
                  />

                  <button
                    type="submit"
                    disabled={
                      (!messageInput.trim() && selectedFiles.length === 0) ||
                      sending ||
                      connectionStatus !== 'connected'
                    }
                    aria-label="Send message"
                  >
                    <FontAwesomeIcon icon={sending ? faSpinner : faPaperPlane} spin={sending} />
                  </button>
                </div>

                <div className="chat-composer-footer">
                  <span role={uploadProgress ? 'status' : undefined} aria-live="polite">
                    {uploadProgress || 'Enter to send · Shift + Enter for a new line'}
                  </span>

                  <span>
                    {messageInput.length}/5000
                  </span>
                </div>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

export default MessagesPage;