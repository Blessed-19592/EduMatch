import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import {
  faArrowLeft,
  faPaperPlane,
  faComments,
  faUsers,
  faCircle,
  faRotate,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import api, { getApiErrorMessage } from '../../api/api';
import './MessagesPage.css';

const API_BASE_URL =
  api.defaults.baseURL ||
  import.meta.env.VITE_API_URL ||
  'http://localhost:5000/api';

const SOCKET_URL = API_BASE_URL.replace(/\/api\/?$/, '');

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
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');

  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);

  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [error, setError] = useState('');
  const [mobileChatOpen, setMobileChatOpen] = useState(false);

  const socketRef = useRef(null);
  const selectedGroupRef = useRef(null);
  const messageEndRef = useRef(null);

  // Keep the selected group available to socket event handlers.
  useEffect(() => {
    selectedGroupRef.current = selectedGroup;
  }, [selectedGroup]);

  // Load groups the student belongs to.
  const loadGroups = useCallback(async () => {
    try {
      setLoadingGroups(true);
      setError('');

      const response = await api.get('/groups/my-groups');

      const fetchedGroups = response.data.groups || [];

      setGroups(fetchedGroups);

      setSelectedGroup((current) => {
        if (!current) return null;

        return (
          fetchedGroups.find(
            (group) => group.group_id === current.group_id
          ) || null
        );
      });
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

  // Establish the authenticated Socket.IO connection.
  useEffect(() => {
    const socket = io(SOCKET_URL, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
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

    socket.on('connect_error', () => {
      setConnectionStatus('disconnected');
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
  }, [addMessage]);

  // Join a group and load its chat history.
  const joinGroupChat = (socket, groupId) => {
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
  };

  // Select a group conversation.
  const handleSelectGroup = (group) => {
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
  const handleSendMessage = (event) => {
    event.preventDefault();

    const content = messageInput.trim();
    const socket = socketRef.current;

    if (!content || !selectedGroup || sending) return;

    if (!socket?.connected) {
      setError('You are disconnected. Reconnecting...');
      return;
    }

    if (content.length > 5000) {
      setError('Messages cannot exceed 5,000 characters.');
      return;
    }

    setSending(true);
    setError('');

    socket.emit(
      'group:message',
      {
        groupId: selectedGroup.group_id,
        messageContent: content,
      },
      (response) => {
        setSending(false);

        if (!response || response.status !== 'success') {
          setError(
            response?.message || 'Your message could not be sent.'
          );
          return;
        }

        if (response.message) {
          addMessage(response.message);
        }

        setMessageInput('');
      }
    );
  };

  // Scroll to the latest message.
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'end',
    });
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

  return (
    <div className="messages-page">
      <div className="messages-heading">
        <div>
          <span className="messages-eyebrow">
            COLLABORATION
          </span>

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

            <FontAwesomeIcon icon={faComments} />
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
                >
                  <div className="conversation-avatar">
                    <FontAwesomeIcon icon={faUsers} />
                  </div>

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

                <div className="chat-group-avatar">
                  <FontAwesomeIcon icon={faUsers} />
                </div>

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
              <div className="chat-messages">
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
                            className="chat-message-row"
                          >
                            <div className="chat-message-avatar">
                              {(message.sender_name || '?')
                                .charAt(0)
                                .toUpperCase()}
                            </div>

                            <div className="chat-message-content">
                              <div className="chat-message-meta">
                                <strong>
                                  {message.sender_name ||
                                    'Group member'}
                                </strong>

                                <span>
                                  {formatMessageTime(
                                    message.created_at
                                  )}
                                </span>
                              </div>

                              <div className="chat-message-bubble">
                                {message.message_content}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  )
                )}

                <div ref={messageEndRef} />
              </div>

              {/* MESSAGE COMPOSER */}
              <form
                className="chat-composer"
                onSubmit={handleSendMessage}
              >
                {error && (
                  <div className="chat-error">
                    {error}
                  </div>
                )}

                <div className="chat-input-wrapper">
                  <textarea
                    value={messageInput}
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
                      !messageInput.trim() ||
                      sending ||
                      connectionStatus !== 'connected'
                    }
                    aria-label="Send message"
                  >
                    <FontAwesomeIcon icon={faPaperPlane} />
                  </button>
                </div>

                <div className="chat-composer-footer">
                  <span>
                    Press Enter to send · Shift + Enter for a new line
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