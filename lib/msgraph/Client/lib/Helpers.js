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
module.exports = {
    clearQuotes: function (value) {
        if (typeof value != 'string') return value;
        if ((value.substr(0, 1) == '"') && (value.substr(-1) == '"')) return value.substr(1, value.length - 2);
        if ((value.substr(0, 1) == "'") && (value.substr(-1) == "'")) return value.substr(1, value.length - 2);
    },

    extractMultipairValues: function (string) {
        let values = {}
        string.split(';').forEach((cookie) => {
            let [name, value] = cookie.split('=');
            values[name.trim()] = value === undefined ? undefined : value.trim();
        })
        return values;
    }
}