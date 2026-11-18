// Keep unclaimed earned rewards visible, then fill the window with future days.
module.exports = function calendarDays(days, plan, grants, size = 30) {
  const claimed = new Set(grants.map((g) => g.day));
  const pending = plan
    .filter((r) => r.day <= days && !claimed.has(r.day))
    .map((r) => r.day)
    .sort((a, b) => a - b);
  return pending
    .slice(0, size)
    .concat(
      Array.from(
        { length: Math.max(0, size - pending.length) },
        (_, i) => days + i + 1,
      ),
    );
};
