//TODO: Cache results of spotify api
var socket = undefined;
var token = undefined;
var connection = undefined;
var is_paused = true;
var host = window.location.host;

function delay(callback, ms) {
    var timer = 0;
    return function () {
        var context = this, args = arguments;
        clearTimeout(timer);
        timer = setTimeout(function () {
            callback.apply(context, args);
        }, ms || 0);
    };
}

$(document).ready(function () {
    $('#search_for_song').keyup(delay(function (e) {
        search(20)
    }, 600));

    $('.tabs').tabs();
    $('.modal').modal({});
    populateQueue([]);
    $.ajax({
        url: `${host}/api/spotify/token`,
        success: function (data) {
            token = data.result
        }
    })
    $.ajax({
        url: `${host}/api/web/addr`,
        success: function (data) {
            socket = data.result;
            connection = new WebSocket(socket)
            addOn(5);
        },
        error: function (data) {
            document.getElementById("SongName").innerHTML = "Error Connecting to Socket";
            document.getElementById("SongDescription").innerHTML = "";
        }
    })
    setInterval(function () {
        if (!is_paused) {
            let val = document.getElementById("seekAudio");
            val.value = parseInt(val.value) + 500;
            document.getElementById("songCurrent").innerHTML = millisToMinutesAndSeconds(parseInt(val.value));
        }
    }, 500);
});

$("#searchForm").submit(function (e) {
    e.preventDefault();
});

function millisToMinutesAndSeconds(millis) {
    var minutes = Math.floor(millis / 60000);
    var seconds = ((millis % 60000) / 1000).toFixed(0);
    return minutes + ":" + (seconds < 10 ? '0' : '') + seconds;
}

function updateImage() {
    document.getElementById("albumcover").src = `${host}/api/spotify/cached-album-cover?cachebreak${new Date().getTime()}`;
}

function updateSeekInfo(state) {
    document.getElementById("seekAudio").max = state.track.duration_ms;
    document.getElementById("seekAudio").value = state.playback_position;
    document.getElementById("songLen").innerHTML = millisToMinutesAndSeconds(state.track.duration_ms);
}

function addOn(maxTries) {
    connection = new WebSocket(socket);
    connection.onmessage = function (m) {
        msg = JSON.parse(m.data);
        console.log(msg);
        is_paused = msg["is_paused"];
        (msg["is_paused"]) ? document.getElementById("PlayIcon").innerHTML = "play_arrow" : document.getElementById("PlayIcon").innerHTML = "pause";
        document.getElementById("SongName").innerHTML = msg["track"]["name"];
        document.getElementById("SongDescription").innerHTML = "By " + msg["track"]["artist"]["name"]
        updateImage();
        updateSeekInfo(msg);
        populateQueue(msg.queue);
    };
    connection.onclose = function m(uri, protocol) {
        console.log("on close");
        let ele = document.getElementById("conStatusBar");
        ele.classList.remove("green");
        ele.classList.add("red");

        console.log("Max tries " + maxTries);
        if (maxTries >= 0) {
            setTimeout(function () {
                document.getElementById("conStatusBarMsg").innerText = "Trying to reconnect..." + maxTries + " tries left";
                console.log("Trying to connect again. " + maxTries + " tries left");
                addOn(--maxTries);
            }, 1000);
        }


    };
    connection.onopen = function (event) {
        maxTries = 10;
        let ele = document.getElementById("conStatusBar");
        ele.classList.remove("red");
        ele.classList.add("green");
        document.getElementById("conStatusBarMsg").innerText = "Connected to server";

    };
}

function onPrevious() {
    connection.send(JSON.stringify({'payload': 'previous'}));
}

function onSeek() {
    connection.send(JSON.stringify({'payload': 'seek', 'position': document.getElementById("seekAudio").value}));
}

function search(limit) {
    let q = $("#search_for_song").val();
    console.log(`${q} and if ${q == true}`)
    if (q) {
        $.ajax({
                url: `https://api.spotify.com/v1/search?q=${q}&type=track&limit=${limit}`,
                headers: {
                    'Authorization': 'Bearer ' + token
                },
                success: function (data) {
                    console.log("LOG Search yay")

                    let songs = data.tracks.items;
                    let res = "";
                    for (let tracks of data.tracks.items) {
                        let id = tracks.uri.split(":")[2]
                        res = res + `
                            <li class="collection-item avatar">
                                <img height="64" src="${tracks.album.images[0].url}" alt="albumArt" class="circle">
                                <span class="title">${tracks.name}</span>
                                <p>${tracks.artists[0].name}</p>
                                <a id="${id}" href="#" onclick="addToQueue('${tracks.uri}','${id}')" class="secondary-content scale-transition">
                                    <i class="material-icons">add</i>
                                </a>
                                <a id="${id}check" href="#" class="secondary-content scale-transition scale-out">
                                    <i class="material-icons">check</i>
                                </a>
                            </li>`;
                    }
                    if (!res) {
                        res = `<li class="collection-item avatar">
                                    <img height="64" src="http://pixelartmaker.com/art/8e901395c4a3dd4.png" alt="albumArt" class="circle">
                                    <span class="title">No Search Reuslt</span>
                                    <p>Nothing to show here</p>
                                </li>`;
                    }
                    document.getElementById("searchColl").innerHTML = res;
                },
                error: function (error) {
                    console.log("LOG Search errr")
                    document.getElementById("searchColl").innerHTML = `<li class="collection-item avatar">
                        <img height="64" src="http://pixelartmaker.com/art/8e901395c4a3dd4.png" alt="albumArt" class="circle">
                        <span class="title">An Error Occurred</span>
                        <p>${error}</p>
                    </li>`;
                }
            }
        );
    }
}

function onNext() {
    connection.send(JSON.stringify({'payload': 'next'}));
}

function onPlay() {
    connection.send(JSON.stringify({'payload': 'play'}));
}

function addToQueue(uri, id) {
    connection.send(JSON.stringify({'payload': 'playUri', 'uri': uri}));
    console.log(id);
    $(`#${id}`).addClass('scale-out');
    $(`#${id}check`).removeClass('scale-out')
}

function onQueue() {
    try {
        regex = /(track\/)([0-9A-z]*)/;
        uri = "spotify:track:" + regex.exec(document.getElementById("song_uri").value)[2];
        connection.send(JSON.stringify({'payload': 'playUri', 'uri': uri}));
        document.getElementById("song_uri").value = "";
    } catch (err) {
        alert("Invalid link or socket error");
    }
}

// function playURI(uri) {
//     connection.send(JSON.stringify({'payload': 'playUri', 'uri': uri}));
//     $('#modal').modal('close');
// }

function populateQueue(queue) {
    //TODO: get this from server to avoid rate limits by spotify api
    let trackIds = "";

    for (let uriQ of queue) {
        trackIds = trackIds + ((trackIds.length === 0) ? "" : ",") + uriQ.split(":")[2];
    }
    if (trackIds.length !== 0) {
        $.ajax({
            url: "https://api.spotify.com/v1/tracks/?ids=" + trackIds,
            headers: {
                'Authorization': 'Bearer ' + token
            },
            success: function (data) {
                let res = "";
                for (let tracks of data.tracks) {
                    res = res + `<li class="collection-item avatar">\n` +
                        `                        <img height="64" src="${tracks.album.images[0].url}" alt="albumArt" class="circle">\n` +
                        `                        <span class="title">${tracks.name}</span>\n` +
                        `                        <p>${tracks.artists[0].name}</p>\n` +
                        `                    </li>`;
                }
                document.getElementById("queueCollection").innerHTML = res;
            }
        });
    } else {
        let res = `<li class="collection-item avatar">\n` +
            `                        <img height="64" src="http://pixelartmaker.com/art/8e901395c4a3dd4.png" alt="" class="circle">\n` +
            `                        <span class="title">Nothing Added Yet</span>\n` +
            `                        <p>Add a song and it will appear here!</p>\n` +
            `                    </li>`;
        document.getElementById("queueCollection").innerHTML = res
    }
}