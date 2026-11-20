import { useCallback, useEffect, useState } from 'react';
import api from '../../api/api';
import './GroupInvitationPanel.css';

export default function GroupInvitationPanel({ groupId }) {
    const [students, setStudents] = useState([]);
    const [selectedStudent, setSelectedStudent] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');

    const loadEligibleCollaborators = useCallback(async () => {
        try {
            setLoading(true);
            setError('');

            const response = await api.get(
                `/groups/${groupId}/eligible-collaborators`
            );

            const eligibleStudents = response.data.data.students || [];
            setStudents(eligibleStudents);
        } catch (err) {
            setError(
                err.response?.data?.message ||
                'Unable to load eligible collaborators.'
            );
        } finally {
            setLoading(false);
        }
    }, [groupId]);

    useEffect(() => {
        loadEligibleCollaborators();
    }, [loadEligibleCollaborators]);

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (!selectedStudent) {
            setError('Select a student to invite.');
            return;
        }

        try {
            setSending(true);
            setError('');
            setNotice('');

            const response = await api.post(
                `/groups/${groupId}/invitations`,
                {
                    inviteeId: selectedStudent,
                    message: message.trim() || null
                }
            );

            setNotice(
                response.data.message || 'Invitation sent successfully.'
            );
            setSelectedStudent('');
            setMessage('');

            await loadEligibleCollaborators();
        } catch (err) {
            setError(
                err.response?.data?.message ||
                'Unable to send the invitation.'
            );
        } finally {
            setSending(false);
        }
    };

    return (
        <section className="group-invitation-panel">
            <div className="group-invitation-heading">
                <div>
                    <h3>Invite a Collaborator</h3>
                    <p>
                        Invite someone you have already connected with
                        through EduMatch.
                    </p>
                </div>
            </div>

            {error && (
                <div className="invitation-feedback error" role="alert">
                    {error}
                </div>
            )}

            {notice && (
                <div className="invitation-feedback success" role="status">
                    {notice}
                </div>
            )}

            {loading ? (
                <p className="invitation-loading">
                    Loading eligible collaborators...
                </p>
            ) : students.length === 0 ? (
                <p className="invitation-empty">
                    No eligible collaborators are currently available.
                    You need an accepted collaboration request before
                    inviting someone to this group.
                </p>
            ) : (
                <form onSubmit={handleSubmit}>
                    <label htmlFor="invite-student">
                        Select collaborator
                    </label>

                    <select
                        id="invite-student"
                        value={selectedStudent}
                        onChange={(event) =>
                            setSelectedStudent(event.target.value)
                        }
                        required
                    >
                        <option value="">Choose a student</option>

                        {students.map((student) => (
                            <option
                                key={student.student_id}
                                value={student.student_id}
                            >
                                {student.full_name}
                                {student.course_name
                                    ? ` — ${student.course_name}`
                                    : ''}
                                {student.year_of_study
                                    ? ` (Year ${student.year_of_study})`
                                    : ''}
                            </option>
                        ))}
                    </select>

                    <label htmlFor="invitation-message">
                        Invitation message (optional)
                    </label>

                    <textarea
                        id="invitation-message"
                        value={message}
                        onChange={(event) => setMessage(event.target.value)}
                        maxLength={1000}
                        placeholder="Tell them why you'd like them to join your group..."
                        rows={3}
                    />

                    <button
                        type="submit"
                        disabled={sending || !selectedStudent}
                    >
                        {sending ? 'Sending...' : 'Send Invitation'}
                    </button>
                </form>
            )}
        </section>
    );
}