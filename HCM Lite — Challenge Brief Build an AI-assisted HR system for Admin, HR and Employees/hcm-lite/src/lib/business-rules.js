/**
 * Calculates annual income tax based on the hackathon brief slabs:
 * - 0 - 600k: 0
 * - 600k - 1.2M: 5% of excess over 600k
 * - 1.2M - 2.4M: 30k + 15% of excess over 1.2M
 * - 2.4M - 3.6M: 210k + 25% of excess over 2.4M
 * - Above 3.6M: 510k + 35% of excess over 3.6M
 * @param {number} annualGross
 * @returns {number} annualTax
 */
export function calculateAnnualTax(annualGross) {
  if (annualGross <= 600000) {
    return 0;
  } else if (annualGross <= 1200000) {
    return (annualGross - 600000) * 0.05;
  } else if (annualGross <= 2400000) {
    return 30000 + (annualGross - 1200000) * 0.15;
  } else if (annualGross <= 3600000) {
    return 210000 + (annualGross - 2400000) * 0.25;
  } else {
    return 510000 + (annualGross - 3600000) * 0.35;
  }
}

/**
 * Calculates monthly tax share from gross salary
 * @param {number} monthlyGross
 * @returns {number} monthlyTax
 */
export function calculateMonthlyTax(monthlyGross) {
  const annualGross = monthlyGross * 12;
  const annualTax = calculateAnnualTax(annualGross);
  return Math.round((annualTax / 12) * 100) / 100;
}

/**
 * Parses time string "HH:MM" to minutes from midnight
 */
export function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const [hours, mins] = timeStr.split(':').map(Number);
  return hours * 60 + (mins || 0);
}

/**
 * Checks attendance status on check-in
 * @param {Date} checkInDate
 * @param {string} officeStartStr e.g. "09:00"
 * @param {number} graceMinutes e.g. 15
 * @returns {{ isLate: boolean, lateMinutes: number, status: string }}
 */
export function evaluateCheckIn(checkInDate, officeStartStr = '09:00', graceMinutes = 15) {
  const checkInHours = checkInDate.getHours();
  const checkInMins = checkInDate.getMinutes();
  const checkInTotalMins = checkInHours * 60 + checkInMins;

  const thresholdMins = timeToMinutes(officeStartStr) + graceMinutes;
  const isLate = checkInTotalMins > thresholdMins;
  const lateMinutes = isLate ? checkInTotalMins - thresholdMins : 0;

  return {
    isLate,
    lateMinutes,
    status: isLate ? 'late' : 'present',
  };
}

/**
 * Checks attendance status after check-out
 * @param {number} workedHours
 * @param {boolean} wasLate
 * @param {number} halfDayHoursThreshold e.g. 5
 * @returns {string} finalStatus
 */
export function evaluateCheckOut(workedHours, wasLate, halfDayHoursThreshold = 5) {
  if (workedHours < halfDayHoursThreshold) {
    return 'half_day';
  }
  return wasLate ? 'late' : 'present';
}

/**
 * Formats a Date to YYYY-MM-DD
 */
export function formatDate(d) {
  const date = new Date(d);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Calculates working days between two YYYY-MM-DD strings inclusive,
 * skipping weekend days and public holiday dates.
 * @param {string} startDateStr "YYYY-MM-DD"
 * @param {string} endDateStr "YYYY-MM-DD"
 * @param {number[]} weekendDays array of day numbers (0=Sun, 6=Sat)
 * @param {string[]} holidayDateStrs array of "YYYY-MM-DD"
 * @returns {number}
 */
export function calculateWorkingDays(startDateStr, endDateStr, weekendDays = [0, 6], holidayDateStrs = []) {
  const start = new Date(startDateStr + 'T00:00:00');
  const end = new Date(endDateStr + 'T00:00:00');
  const holidaySet = new Set(holidayDateStrs);

  let workingDays = 0;
  const current = new Date(start);

  while (current <= end) {
    const dayOfWeek = current.getDay();
    const dateFormatted = formatDate(current);

    if (!weekendDays.includes(dayOfWeek) && !holidaySet.has(dateFormatted)) {
      workingDays++;
    }
    current.setDate(current.getDate() + 1);
  }

  return workingDays;
}

/**
 * Haversine formula to compute distance in meters between two lat/lng coordinates
 */
export function getDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth radius in meters
  const toRad = (deg) => (deg * Math.PI) / 180;
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const deltaPhi = toRad(lat2 - lat1);
  const deltaLambda = toRad(lon2 - lon1);

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) *
    Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
