SELECT
  users.email,
  users.name,
  plans.code AS plan_code,
  plans.name AS plan_name,
  subscriptions.status,
  subscriptions.current_period_start,
  subscriptions.current_period_end
FROM subscriptions
JOIN users ON users.id = subscriptions.user_id
JOIN plans ON plans.id = subscriptions.plan_id
ORDER BY subscriptions.updated_at DESC;

SELECT
  users.email,
  usage_events.event_type,
  SUM(usage_events.amount)::int AS used_this_month
FROM usage_events
JOIN users ON users.id = usage_events.user_id
WHERE usage_events.created_at >= date_trunc('month', NOW())
GROUP BY users.email, usage_events.event_type
ORDER BY users.email, usage_events.event_type;
