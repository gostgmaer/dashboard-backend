import Cookies from "js-cookie";
import moment from "moment";
// Export the calculateTimeGap function with maxGap parameter
export function calculateTimeGap(date1, date2, maxGap) {
  const momentDate1 = moment(date1, "YYYY-MM-DD HH:mm:ss");
  const momentDate2 = date2 ? moment(date2, "YYYY-MM-DD HH:mm:ss") : moment();

  // Calculate the time gap duration
  const duration = moment.duration(momentDate2.diff(momentDate1));

  // Calculate the years and months in the duration
  const years = duration.years();
  const months = duration.months();

  // Check if the duration exceeds the maximum allowable time gap in months
  if (duration.asMonths() > maxGap) {
    return `Time Gap exceeds the maximum allowable (${maxGap} months)`;
  }

  // Format the duration based on the maxGap value
  let formattedDuration = "";
  if (years > 0) {
    formattedDuration += `${years} year${years > 1 ? "s" : ""}`;
  }
  if (months > 0) {
    if (formattedDuration) {
      formattedDuration += " ";
    }
    formattedDuration += `${months} month${months > 1 ? "s" : ""}`;
  }

  return `${formattedDuration}`;
}

export const formatFileSize = (bytes) => {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

export const findIndex = (array, index) => {
  const found = array.find(function (element, ind) {
    return index === ind;
  });
  return found;
};

// export const arrayGroupbykey = (array, key) => {
//   const uniqueCategories = [...new Set(array.map((item) => item[key]))];
//   function filterByCategory(array, key) {
//     return array.filter((item) => item.category === key);
//   }
//   const filteredArrays = [];
//   uniqueCategories.forEach((key) => {
//     const filteredArray = filterByCategory(array, key);
//     filteredArrays.push(filteredArray);
//   });

//   return filteredArrays;
// };

export const setToken = (name, value, days, type) => {
  if (type === "ACCESS_TOKEN") {
    const token = value.split(".");
    setClientCookie("headerPayload", `${token[0]}.${token[1]}`, days);
    setClientCookie("signature", `${token[2]}`, days);
  } else {
    setClientCookie(name, value, days);
  }
};


export const setClientCookie = (name, value, timestamp) => {
  const expirationDate = new Date(timestamp * 1000); // Convert Unix timestamp to milliseconds
  Cookies.set(name, value, { expires: expirationDate });
};
