-- Transition manager shared approved-user allowance from pilot 50/5 to Owner-approved 200/10.
-- Only update exact default baseline; preserve any Owner-customized limits.
-- Account-first V2 remains gated OFF until migration and policy readback are accepted.
UPDATE manager_approval_limits
 SET learner_limit=200,teacher_limit=10
 WHERE scope='manager-tier' AND learner_limit=50 AND teacher_limit=5;
--> statement-breakpoint
