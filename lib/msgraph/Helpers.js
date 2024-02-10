/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// (C) 2024 Joost Brugman
//
// This is a very limited and crude implementation of a task that processes emails from a mailbox. This was made in a hurry as a temporary solution
// and probably has a lot o bugs and issues that were not exposed in our specific use case. Feel free to use this at your own peril. Be very, very
// prudent in your testing to ensure this works as expected in your specific use case. According to general best practices this should be rewritten
// to be more robust and reliable. On that bases you could argue this is not a production ready solution. Again, use at your own risk. 
//
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function dateSegments(date) {
    if (typeof date === 'string') date = new Date(date);
    if (typeof date === 'undefined') date = new Date();
    return (date === undefined ? new Date() : date).toISOString().substr(0, 10).split('-');
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
module.exports = {
    timeout: async (t) => {
        return new Promise((resolve, reject) => {
            setTimeout(resolve, t);
        });
    },
    date: {
        iso: (date) => {
            let [year, month, day] = dateSegments(date);
            return `${year}-${month}-${day}`;
        },
        nl: (date) => {
            let [year, month, day] = dateSegments(date);
            return `${day}-${month}-${year}`;
        }
    }
}
