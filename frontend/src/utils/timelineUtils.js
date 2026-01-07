import { format, parseISO } from 'date-fns';

export const processTimelineData = (photos, columns = 5) => {
  if (!photos || photos.length === 0) return [];

  const rows = [];
  let currentYear = null;
  let currentMonth = null;
  let currentRow = [];

  // Helper to flush the current row of photos to the list
  const flushRow = () => {
    if (currentRow.length > 0) {
      rows.push({ type: 'photos', items: [...currentRow], context: { year: currentYear, month: currentMonth } });
      currentRow = [];
    }
  };

  photos.forEach((photo) => {
    const dateObj = photo.date ? parseISO(photo.date) : null;
    const year = dateObj ? format(dateObj, 'yyyy') : 'Unknown Date';
    const month = dateObj ? format(dateObj, 'MMMM') : ''; // e.g., "January"

    // 1. Detect Year Change
    if (year !== currentYear) {
      flushRow(); // Finish previous month's photos
      currentYear = year;
      currentMonth = null; // Reset month
      rows.push({ type: 'year', label: year, context: { year, month: '' } }); // Add Year Header
    }

    // 2. Detect Month Change
    if (month !== currentMonth) {
      flushRow();
      currentMonth = month;
      if (month) {
        rows.push({ type: 'month', label: month, context: { year, month } }); // Add Month Header
      }
    }

    // 3. Add Photo to Buffer
    currentRow.push(photo);

    // 4. If Buffer Full, Create a Grid Row
    if (currentRow.length === columns) {
      flushRow();
    }
  });

  // Flush any remaining photos
  flushRow();

  return rows;
};