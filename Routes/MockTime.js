var Time = function() {
   var date = new Date();
   
   date.setTime(date.getTime() + Time.offset);

   return date;
};

Time.offset = 0;

module.exports = Time;