const dayjs = require('dayjs');
const duration = require('dayjs/plugin/duration');
dayjs.extend(duration);

/**
 * Calculate time gap between two dates
 */
function calculateTimeGap(date1, date2, maxGap) {
  const d1 = dayjs(date1);
  const d2 = date2 ? dayjs(date2) : dayjs();

  const diffMonths = d2.diff(d1, 'month');

  if (diffMonths > maxGap) {
    return `Time Gap exceeds the maximum allowable (${maxGap} months)`;
  }

  const years = Math.floor(diffMonths / 12);
  const months = diffMonths % 12;

  let formattedDuration = '';
  if (years > 0) {
    formattedDuration += `${years} year${years > 1 ? 's' : ''}`;
  }
  if (months > 0) {
    if (formattedDuration) {
      formattedDuration += ' ';
    }
    formattedDuration += `${months} month${months > 1 ? 's' : ''}`;
  }

  return formattedDuration;
}

const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

const findIndex = (array, index) => {
  return array.find((_element, ind) => index === ind);
};

module.exports = {
  calculateTimeGap,
  formatFileSize,
  findIndex,
};
