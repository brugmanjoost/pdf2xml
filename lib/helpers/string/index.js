module.exports = {
    lpad: function (str, len, token) {
        token = token ?? ' ';
        return ('' + token.repeat(len) + str).substr(-len);
    },
    rpad: function (str, len, token) {
        token = token ?? ' ';
        return ('' + str + token.repeat(len)).substr(0, len);
    }
}