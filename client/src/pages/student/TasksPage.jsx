import { useCallback, useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faClipboardList,
  faPlus,
  faRefresh,
  faClock,
  faUser,
  faHistory,
  faUsers,
  faCheckCircle,
  faCircle,
  faCalendarDays,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';

import api, { getApiErrorMessage } from '../../api/api';
import './TasksPage.css';

const formatDate = (value) => {
  if (!value) return 'No deadline';

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? 'Invalid date'
    : new Intl.DateTimeFormat(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(date);
};

const formatDateTime = (value) => {
  if (!value) return 'Date unavailable';

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? 'Date unavailable'
    : new Intl.DateTimeFormat(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
};

const statusLabels = {
  pending: 'Pending',
  in_progress: 'In progress',
  completed: 'Completed',
};

function TasksPage() {
  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');

  const [tasks, setTasks] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadingTasks, setLoadingTasks] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);

  const [taskTitle, setTaskTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [dueDate, setDueDate] = useState('');

  const [historyTaskId, setHistoryTaskId] = useState(null);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [updatingTaskId, setUpdatingTaskId] = useState(null);
  const [progressNotes, setProgressNotes] = useState({});

  const selectedGroup = groups.find(
    (group) => group.group_id === selectedGroupId
  );

  const isOwner = selectedGroup?.membership_role === 'owner';

  const loadGroups = useCallback(async () => {
    setLoadingGroups(true);
    setError('');

    try {
      const response = await api.get('/groups/my-groups');

      const rows = Array.isArray(response.data?.groups)
        ? response.data.groups
        : [];

      setGroups(rows);

      if (rows.length > 0) {
        setSelectedGroupId((current) => {
          if (current && rows.some((group) => group.group_id === current)) {
            return current;
          }

          return rows[0].group_id;
        });
      } else {
        setSelectedGroupId('');
      }
    } catch (requestError) {
      setError(
        getApiErrorMessage(requestError, 'Could not load your groups.')
      );
    } finally {
      setLoadingGroups(false);
    }
  }, []);

  const loadTasks = useCallback(async (groupId) => {
    if (!groupId) {
      setTasks([]);
      return;
    }

    setLoadingTasks(true);
    setError('');

    try {
      const response = await api.get(`/groups/${groupId}/tasks`);

      setTasks(
        Array.isArray(response.data?.tasks)
          ? response.data.tasks
          : []
      );
    } catch (requestError) {
      setError(
        getApiErrorMessage(requestError, 'Could not load group tasks.')
      );
      setTasks([]);
    } finally {
      setLoadingTasks(false);
    }
  }, []);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  useEffect(() => {
    if (selectedGroupId) {
      setHistoryTaskId(null);
      setHistory([]);
      loadTasks(selectedGroupId);
    } else {
      setTasks([]);
    }
  }, [selectedGroupId, loadTasks]);

  const handleCreateTask = async (event) => {
    event.preventDefault();

    if (!selectedGroupId) return;

    setCreating(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        taskTitle: taskTitle.trim(),
        description: description.trim() || undefined,
        priority,
        assignedTo: null,
        dueDate: dueDate
          ? new Date(`${dueDate}T23:59:00`).toISOString()
          : null,
      };

      await api.post(
        `/groups/${selectedGroupId}/tasks`,
        payload
      );

      setTaskTitle('');
      setDescription('');
      setPriority('medium');
      setDueDate('');
      setShowCreateForm(false);

      setSuccess('Task created successfully.');

      await loadTasks(selectedGroupId);
    } catch (requestError) {
      setError(
        getApiErrorMessage(requestError, 'Could not create the task.')
      );
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateProgress = async (task) => {
    const currentStatus = task.task_status;

    const nextStatus = {
      pending: 'in_progress',
      in_progress: 'completed',
      completed: 'pending',
    }[currentStatus];

    if (!nextStatus) return;

    setUpdatingTaskId(task.task_id);
    setError('');
    setSuccess('');

    try {
      await api.patch(
        `/groups/tasks/${task.task_id}/progress`,
        {
          newStatus: nextStatus,
          progressNote: progressNotes[task.task_id]?.trim() || undefined,
        }
      );

      setProgressNotes((current) => ({
        ...current,
        [task.task_id]: '',
      }));

      setSuccess('Task progress updated.');

      await loadTasks(selectedGroupId);

      if (historyTaskId === task.task_id) {
        await loadHistory(task.task_id);
      }
    } catch (requestError) {
      setError(
        getApiErrorMessage(
          requestError,
          'Could not update task progress.'
        )
      );
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const loadHistory = async (taskId) => {
    setLoadingHistory(true);
    setError('');

    try {
      const response = await api.get(
        `/groups/tasks/${taskId}/progress`
      );

      setHistory(
        Array.isArray(response.data?.history)
          ? response.data.history
          : []
      );

      setHistoryTaskId(taskId);
    } catch (requestError) {
      setError(
        getApiErrorMessage(
          requestError,
          'Could not load task progress history.'
        )
      );
    } finally {
      setLoadingHistory(false);
    }
  };

  const completedCount = tasks.filter(
    (task) => task.task_status === 'completed'
  ).length;

  const pendingCount = tasks.filter(
    (task) => task.task_status === 'pending'
  ).length;

  const progressCount = tasks.filter(
    (task) => task.task_status === 'in_progress'
  ).length;

  if (loadingGroups) {
    return (
      <div className="tasks-page">
        <div className="tasks-loading">Loading your groups...</div>
      </div>
    );
  }

  return (
    <div className="tasks-page">
      <header className="tasks-heading">
        <div>
          <span className="tasks-eyebrow">GROUP COLLABORATION</span>
          <h1>Tasks &amp; Progress</h1>
          <p>Organise group responsibilities and track completed work.</p>
        </div>

        <div className="tasks-heading-icon">
          <FontAwesomeIcon icon={faClipboardList} />
        </div>
      </header>

      {error && (
        <div className="tasks-alert error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setError('')}>
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>
      )}

      {success && (
        <div className="tasks-alert success" role="status">
          <span>{success}</span>
          <button type="button" onClick={() => setSuccess('')}>
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>
      )}

      {groups.length === 0 ? (
        <section className="tasks-empty">
          <FontAwesomeIcon icon={faUsers} />
          <h2>No groups available</h2>
          <p>Join or create a group before managing collaboration tasks.</p>
        </section>
      ) : (
        <>
          <section className="tasks-group-selector">
            <label htmlFor="tasks-group">
              Select a group
            </label>

            <select
              id="tasks-group"
              value={selectedGroupId}
              onChange={(event) => setSelectedGroupId(event.target.value)}
            >
              {groups.map((group) => (
                <option key={group.group_id} value={group.group_id}>
                  {group.group_name}
                </option>
              ))}
            </select>

            <button
              type="button"
              className="tasks-refresh"
              onClick={() => loadTasks(selectedGroupId)}
              disabled={loadingTasks}
              aria-label="Refresh tasks"
            >
              <FontAwesomeIcon
                icon={faRefresh}
                spin={loadingTasks}
              />
            </button>
          </section>

          <section className="tasks-summary">
            <div>
              <span>Total tasks</span>
              <strong>{tasks.length}</strong>
            </div>

            <div>
              <span>Pending</span>
              <strong>{pendingCount}</strong>
            </div>

            <div>
              <span>In progress</span>
              <strong>{progressCount}</strong>
            </div>

            <div>
              <span>Completed</span>
              <strong>{completedCount}</strong>
            </div>
          </section>

          <div className="tasks-section-heading">
            <div>
              <h2>Group tasks</h2>
              <p>
                {selectedGroup?.group_name}
                {' · '}
                {isOwner ? 'You are the group owner' : 'Group member'}
              </p>
            </div>

            {isOwner && (
              <button
                type="button"
                className="tasks-create-button"
                onClick={() => setShowCreateForm((current) => !current)}
              >
                <FontAwesomeIcon icon={showCreateForm ? faXmark : faPlus} />
                {showCreateForm ? 'Cancel' : 'Create task'}
              </button>
            )}
          </div>

          {showCreateForm && isOwner && (
            <form className="tasks-create-form" onSubmit={handleCreateTask}>
              <h3>Create a group task</h3>

              <label htmlFor="task-title">Task title</label>
              <input
                id="task-title"
                type="text"
                minLength={3}
                maxLength={150}
                value={taskTitle}
                onChange={(event) => setTaskTitle(event.target.value)}
                placeholder="e.g. Complete the research section"
                required
              />

              <label htmlFor="task-description">Description</label>
              <textarea
                id="task-description"
                maxLength={3000}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Describe what needs to be done..."
                rows={4}
              />

              <div className="tasks-form-grid">
                <div>
                  <label htmlFor="task-priority">Priority</label>
                  <select
                    id="task-priority"
                    value={priority}
                    onChange={(event) => setPriority(event.target.value)}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="task-deadline">Deadline</label>
                  <input
                    id="task-deadline"
                    type="date"
                    value={dueDate}
                    onChange={(event) => setDueDate(event.target.value)}
                  />
                </div>
              </div>

              <button
                type="submit"
                className="tasks-submit-button"
                disabled={creating}
              >
                {creating ? 'Creating...' : 'Create task'}
              </button>
            </form>
          )}

          {loadingTasks ? (
            <div className="tasks-loading">Loading group tasks...</div>
          ) : tasks.length === 0 ? (
            <div className="tasks-empty">
              <FontAwesomeIcon icon={faClipboardList} />
              <h2>No tasks yet</h2>
              <p>
                {isOwner
                  ? 'Create the first task for your group.'
                  : 'Your group owner has not created any tasks yet.'}
              </p>
            </div>
          ) : (
            <div className="tasks-list">
              {tasks.map((task) => {
                const isCompleted = task.task_status === 'completed';

                return (
                  <article className="task-card" key={task.task_id}>
                    <div className="task-card-top">
                      <span className={`task-priority ${task.priority}`}>
                        {task.priority} priority
                      </span>

                      <span className={`task-status ${task.task_status}`}>
                        {statusLabels[task.task_status] || task.task_status}
                      </span>
                    </div>

                    <h3>{task.task_title}</h3>

                    {task.description && (
                      <p className="task-description">
                        {task.description}
                      </p>
                    )}

                    <div className="task-meta">
                      <span>
                        <FontAwesomeIcon icon={faUser} />
                        {task.assigned_to_name || 'Unassigned'}
                      </span>

                      <span>
                        <FontAwesomeIcon icon={faCalendarDays} />
                        {formatDate(task.due_date)}
                      </span>

                      <span>
                        <FontAwesomeIcon icon={faClock} />
                        Created by {task.created_by_name || 'Group owner'}
                      </span>
                    </div>

                    <div className="task-card-actions">
                      <div className="task-progress-control">
                        <label htmlFor={`note-${task.task_id}`}>
                          Progress note
                        </label>

                        <textarea
                          id={`note-${task.task_id}`}
                          rows={2}
                          maxLength={2000}
                          value={progressNotes[task.task_id] || ''}
                          onChange={(event) =>
                            setProgressNotes((current) => ({
                              ...current,
                              [task.task_id]: event.target.value,
                            }))
                          }
                          placeholder="Add an update about this task..."
                        />

                        <button
                          type="button"
                          className="task-update-button"
                          onClick={() => handleUpdateProgress(task)}
                          disabled={updatingTaskId === task.task_id}
                        >
                          {updatingTaskId === task.task_id
                            ? 'Updating...'
                            : isCompleted
                              ? 'Reopen task'
                              : task.task_status === 'pending'
                                ? 'Start task'
                                : 'Mark completed'}
                        </button>
                      </div>

                      <button
                        type="button"
                        className="task-history-button"
                        onClick={() =>
                          historyTaskId === task.task_id
                            ? setHistoryTaskId(null)
                            : loadHistory(task.task_id)
                        }
                      >
                        <FontAwesomeIcon icon={faHistory} />
                        {historyTaskId === task.task_id
                          ? 'Hide history'
                          : 'Progress history'}
                      </button>
                    </div>

                    {historyTaskId === task.task_id && (
                      <div className="task-history">
                        <h4>Progress history</h4>

                        {loadingHistory ? (
                          <p>Loading history...</p>
                        ) : history.length === 0 ? (
                          <p>No progress updates have been recorded.</p>
                        ) : (
                          history.map((entry) => (
                            <div
                              className="task-history-entry"
                              key={entry.progress_id}
                            >
                              <FontAwesomeIcon icon={faCircle} />

                              <div>
                                <strong>
                                  {entry.changed_by_name || 'Group member'}
                                </strong>

                                <p>
                                  {statusLabels[entry.previous_status] ||
                                    entry.previous_status}
                                  {' → '}
                                  {statusLabels[entry.new_status] ||
                                    entry.new_status}
                                </p>

                                {entry.progress_note && (
                                  <p>{entry.progress_note}</p>
                                )}

                                <small>
                                  {formatDateTime(entry.created_at)}
                                </small>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default TasksPage;