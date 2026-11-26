import assert from 'node:assert/strict';
import test from 'node:test';
import pool from '../src/config/database.js';
import { approveAllSubmittedStudentProfiles } from '../src/services/adminProfileService.js';

test('bulk approval updates only submitted active student profiles and records approvals', async (t) => {
    const queries = [];
    let released = false;
    const client = {
        async query(sql, values) {
            queries.push({ sql, values });
            if (sql.includes('WITH approved_profiles')) {
                return { rows: [{ approvedCount: 3 }] };
            }
            return { rows: [] };
        },
        release() {
            released = true;
        }
    };

    t.mock.method(pool, 'connect', async () => client);

    const result = await approveAllSubmittedStudentProfiles('admin-id');
    const approvalQuery = queries.find(({ sql }) => sql.includes('WITH approved_profiles'));

    assert.deepEqual(result, { approvedCount: 3 });
    assert.equal(queries[0].sql, 'BEGIN');
    assert.match(approvalQuery.sql, /u\.role = 'student'/);
    assert.match(approvalQuery.sql, /u\.account_status = 'active'/);
    assert.match(approvalQuery.sql, /sp\.profile_review_status = 'submitted'/);
    assert.match(approvalQuery.sql, /INSERT INTO profile_review_history/);
    assert.deepEqual(approvalQuery.values, ['admin-id']);
    assert.equal(queries[2].sql, 'COMMIT');
    assert.equal(released, true);
});

test('bulk approval rolls back and releases the connection when the update fails', async (t) => {
    const queries = [];
    let released = false;
    const client = {
        async query(sql) {
            queries.push(sql);
            if (sql.includes('WITH approved_profiles')) {
                throw new Error('database failure');
            }
            return { rows: [] };
        },
        release() {
            released = true;
        }
    };

    t.mock.method(pool, 'connect', async () => client);

    await assert.rejects(
        approveAllSubmittedStudentProfiles('admin-id'),
        /database failure/
    );

    assert.equal(queries[0], 'BEGIN');
    assert.match(queries[1], /WITH approved_profiles/);
    assert.equal(queries[2], 'ROLLBACK');
    assert.equal(released, true);
});
