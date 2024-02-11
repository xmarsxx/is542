const Scriptures = (function () {
  ("use strict");

  // Constants
  const DIV_SCRIPTURES = "scriptures";
  const REQUEST_GET = "GET";
  const REQUEST_STATUS_OK = 200;
  const REQUEST_STATUS_ERROR = 400;
  const URL_BASE = "https://scriptures.byu.edu/mapscrip/";
  const URL_BOOKS = `${URL_BASE}model/books.php`;
  const URL_SCRIPTURES = `${URL_BASE}mapgetscrip.php`;
  const URL_VOLUMES = `${URL_BASE}model/volumes.php`;

  // Private Variables
  let books;
  let mapPins = [];
  let volumes;

  // Private Method Declarations
  let ajax;
  let bookChapterValid;
  let booksGrid;
  let cacheBooks;
  let encodedScripturesUrl;
  let getScripturesFailure;
  let getScripturesSuccess;
  let init;
  let lastClickedLocation = null;
  let navigateBook;
  let navigateChapter;
  let navigateHome;
  let onHashChanged;
  let volumesGridContent;
  let volumeTitle;

  // Private Methods

  ajax = function (url, successCallback, failureCallback, skipJsonParse) {
    let request = new XMLHttpRequest();

    request.open(REQUEST_GET, url, true);

    request.onload = function () {
      if (
        request.status >= REQUEST_STATUS_OK &&
        request.status < REQUEST_STATUS_ERROR
      ) {
        let data = skipJsonParse
          ? request.response
          : JSON.parse(request.response);

        if (typeof successCallback === "function") {
          successCallback(data);
        }
      } else {
        if (typeof failureCallback === "function") {
          failureCallback(request);
        }
      }
    };

    request.onerror = failureCallback;

    request.send();
  };

  cacheBooks = function (callback) {
    volumes.forEach(function (volume) {
      let volumeBooks = [];
      let bookId = volume.minBookId;

      while (bookId <= volume.maxBookId) {
        volumeBooks.push(books[bookId]);
        bookId += 1;
      }

      volume.books = volumeBooks;
    });

    if (typeof callback === "function") {
      callback();
    }
  };

  init = function (callback) {
    let booksLoaded = false;
    let volumesLoaded = false;

    ajax("https://scriptures.byu.edu/mapscrip/model/books.php", (data) => {
      books = data;
      booksLoaded = true;

      if (volumesLoaded) {
        cacheBooks(callback);
      }
    });
    ajax("https://scriptures.byu.edu/mapscrip/model/volumes.php", (data) => {
      volumes = data;
      volumesLoaded = true;

      if (booksLoaded) {
        cacheBooks(callback);
      }
    });
    // volumes and books are still empty at this point
  };

  bookChapterValid = function (bookId, chapter) {
    const book = books[bookId];

    if (book === undefined) {
        return false;
    }

    // Ensure chapter is an integer
    if (!Number.isInteger(chapter)) {
        return false;
    }

    if (chapter === book.numChapters) {
        return true;
    }

    if (chapter >= 1 && chapter <= book.numChapters) {
        return true;
    }

    return false;
};

  booksGrid = function (volume) {
    let gridContent = `<div class="books">`;

    volume.books.forEach(function (book) {
      gridContent += `<a class=btn" id="${book.id}" href="#${volume.id}:${book.id}">${book.gridName}</a>`;
    });

    return `${gridContent}</div>`;
  };

  chaptersGrid = function (book) {
    let gridContent = `<div class="volume"><h5>${book.fullName}</h5></div><div class="books">`;
    let chapter = 1;

    while (chapter <= book.numChapters) {
      gridContent += `<a class="btn chapter" href="#0:${book.id}:${chapter}">${chapter}</a>`;
      chapter += 1;
    }

    return `${gridContent}</div>`;
  };

  encodedScripturesUrl = function (bookId, chapter, verses, isJst) {
    if (bookId !== undefined && chapter !== undefined) {
      let options = "";

      if (verses !== undefined) {
        options += verses;
      }

      if (isJst !== undefined) {
        options += "&jst=JST";
      }

      return `${URL_SCRIPTURES}?book=${bookId}&chap=${chapter}&verses${options}`;
    }
  };

  getScripturesFailure = function (chapterHtml) {
    document.getElementById(
      DIV_SCRIPTURES
    ).innerHTML = `Unable to retrieve chapter contents.`;
  };

  getScripturesSuccess = function (chaperHtml) {
    document.getElementById(DIV_SCRIPTURES).innerHTML = chaperHtml;
    resetMapPins(extractGeoplaces());
    setupPlaceLinkClickHandlers();
  };

  navigateBook = function (bookId) {
    let book = books[bookId];

    if (book.numChapters <= 1) {
      // For books with no chapters or only 1
      // navigate to the chapter automatically
      navigateChapter(bookId, book.numChapters);
    } else {
      document.getElementById(DIV_SCRIPTURES).innerHTML = chaptersGrid(book);
    }
  };

  navigateChapter = function (bookId, chapter) {
    ajax(
      encodedScripturesUrl(bookId, chapter),
      getScripturesSuccess,
      getScripturesFailure,
      true
    );
  };

  navigateHome = function (volumeId) {
    document.getElementById(
      "scriptures"
    ).innerHTML = `<div id="scripnav">${volumesGridContent(volumeId)}</div>`;
    // console.log(volumesGridContent(volumeId));
  };

  volumesGridContent = function (volumeId) {
    let gridContent = "";

    volumes.forEach(function (volume) {
      if (volumeId === undefined || volumeId === volume.id) {
        gridContent += `<div class="volume">${volumeTitle(volume)}</div>`;
        gridContent += booksGrid(volume);
      }
    });

    return gridContent;
  };

  volumeTitle = function (volume) {
    // console.log(volume.fullName);
    return `<a href="#${volume.id}"><h5>${volume.fullName}</h5></a>`;
  };

  // Map & Pin Functionality

  clearMapPins = function () {
    mapPins.forEach(function (pin) {
      pin.map = null;
    });
    mapPins = [];
  };

  extractGeoplaces = function () {
    const uniqueGeoplaces = {};
    const placeLinks = document.querySelectorAll("a[onclick^='showLocation']");

    placeLinks.forEach(function (placeLink) {
      const onclickAttr = placeLink.getAttribute("onclick");
      // Split and clean up the onclick attribute to extract parameters
      const onclickArgs = onclickAttr
        .match(/showLocation\((.*?)\)/)[1]
        .split(",")
        .map((arg) => arg.trim().replace(/^'(.*)'$/, "$1"));
      const value = {
        latitude: Number(onclickArgs[2]),
        longitude: Number(onclickArgs[3]),
        placename: onclickArgs[1],
        viewAltitude: Number(onclickArgs[8]),
      };
      const key = `${value.latitude}|${value.longitude}`;

      if (!uniqueGeoplaces[key]) {
        uniqueGeoplaces[key] = value;
      }
    });

    return uniqueGeoplaces;
  };

  resetMapPins = function () {
    const geoplaces = extractGeoplaces();
    clearMapPins(); // Assume this properly clears any existing markers from the map

    // Initialize a new bounds object
    const bounds = new google.maps.LatLngBounds();
    let markersCount = 0;

    Object.keys(geoplaces).forEach(function (key) {
      const geoplace = geoplaces[key];
      const position = new google.maps.LatLng(
        geoplace.latitude,
        geoplace.longitude
      );
      const marker = new google.maps.Marker({
        position,
        map,
        title: geoplace.placename,
        label: {
          text: geoplace.placename
          // text: `${geoplace.placename} ${geoplace.longitude} ${geoplace.latitude}`,
        },
        // icon: {
        //   path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW, // Use a predefined shape
        //   fillColor: 'red',
        //   fillOpacity: 0.8,
        //   strokeColor: 'gold',
        //   strokeWeight: 2,
        //   scale: 10, // Size of the SVG symbol
        // }
      });

      // Extend the bounds to include each marker's position
      bounds.extend(position);
      markersCount++;

      mapPins[key] = marker; // Store marker using unique key
    });

    // After adding all markers, adjust the viewport
    if (markersCount === 1) {
      // If there is only one marker, center on it and zoom in
      map.setCenter(bounds.getCenter());
      map.setZoom(15); // Adjust this value as needed
    } else if (markersCount > 1) {
      // If there are multiple markers, fit them within the viewport
      map.fitBounds(bounds);
    }

    // Optional: Adjust this logic if you need to set a minimum zoom level when fitting bounds
    google.maps.event.addListenerOnce(map, "bounds_changed", function (event) {
      if (this.getZoom() > 15) {
        // If the zoom level is too high (i.e., too zoomed in)
        this.setZoom(15); // Set a more "zoomed out" level
      }
    });
  };

  function setupPlaceLinkClickHandlers() {
    const placeLinks = document.querySelectorAll("a[onclick^='showLocation']");
    placeLinks.forEach(function (link) {
      link.addEventListener("click", function (e) {
        e.preventDefault(); // Prevent the default action

        // Retrieve the unique key for the current location
        const onclickAttr = link.getAttribute("onclick");
        const onclickArgs = onclickAttr
          .match(/showLocation\((.*?)\)/)[1]
          .split(",")
          .map((arg) => arg.trim().replace(/^'(.*)'$/, "$1"));
        const [latitude, longitude] = [onclickArgs[2], onclickArgs[3]].map(
          Number
        );
        const key = `${latitude}|${longitude}`;

        // Check if the current location is the same as the last clicked location
        if (lastClickedLocation === key) {
          // If yes, alert the user that this location is already being displayed
          alert("That location is already being displayed.");
        } else {
          // If not, proceed to show the location and update the last clicked location
          if (mapPins && mapPins[key]) {
            const marker = mapPins[key];
            map.setCenter(marker.getPosition());
            map.setZoom(15); // Adjust zoom level as needed
            lastClickedLocation = key; // Update the last clicked location
          } else {
            // If we don't find a marker for the key, it might be useful to handle this case as well
            console.error("Marker not found for the location:", key);
            // Optionally, reset lastClickedLocation if the marker doesn't exist
            // lastClickedLocation = null;
          }
        }
      });
    });
  }

  // Public API --------------------------------------------------------

  onHashChanged = function (event) {
    let ids = [];

    if (location.hash !== "" && location.hash.length > 1) {
      ids = location.hash.slice(1).split(":");
    }

    if (ids.length <= 0) {
      navigateHome();
    } else if (ids.length === 1) {
      const volumeId = Number(ids[0]);

      if (volumes.map((volume) => volume.id).includes(volumeId)) {
        navigateHome(volumeId);
      } else {
        navigateHome();
      }
    } else {
      const bookId = Number(ids[1]);

      if (books[bookId] === undefined) {
        navigateHome();
      } else {
        if (ids.length === 2) {
          navigateBook(bookId);
        } else {
          const chapter = Number(ids[2]);

          if (bookChapterValid(bookId, chapter)) {
            navigateChapter(bookId, chapter);
          } else {
            navigateHome();
          }
        }
      }
    }
  };

  return {
    init,
    onHashChanged,
  };
})();
