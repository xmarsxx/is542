const Scriptures = (function () {
	('use strict');

	// Constants
	const DIV_SCRIPTURES = 'scriptures';
	const DIV_BREADCRUMBS = 'breadcrumbs';
	const REQUEST_GET = 'GET';
	const REQUEST_STATUS_OK = 200;
	const REQUEST_STATUS_ERROR = 400;
	const URL_BASE = 'https://scriptures.byu.edu/mapscrip/';
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
	let updateBreadcrumbs;
	let volumesGridContent;
	let volumeTitle;
	let navigatePreviousChapter;
	let navigateNextChapter;

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

				if (typeof successCallback === 'function') {
					successCallback(data);
				}
			} else {
				if (typeof failureCallback === 'function') {
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

		if (typeof callback === 'function') {
			callback();
		}
	};

	init = function (callback) {
		let booksLoaded = false;
		let volumesLoaded = false;
		let dataLoaded = function () {
			if (booksLoaded && volumesLoaded) {
				if (typeof callback === 'function') {
					cacheBooks(callback);
				}
				// Call onHashChanged after data is loaded
				onHashChanged();
			}
		};

		ajax('https://scriptures.byu.edu/mapscrip/model/books.php', (data) => {
			books = data;
			booksLoaded = true;
			dataLoaded();
		});
		ajax(
			'https://scriptures.byu.edu/mapscrip/model/volumes.php',
			(data) => {
				volumes = data;
				volumesLoaded = true;
				dataLoaded();
			}
		);
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

	encodedScripturesUrl = function (bookId, chapter, verses, isJst) {
		if (bookId !== undefined && chapter !== undefined) {
			let options = '';

			if (verses !== undefined) {
				options += verses;
			}

			if (isJst !== undefined) {
				options += '&jst=JST';
			}

			return `${URL_SCRIPTURES}?book=${bookId}&chap=${chapter}&verses${options}`;
		}
	};

	getScripturesFailure = function (chapterHtml) {
		document.getElementById(
			DIV_SCRIPTURES
		).innerHTML = `Unable to retrieve chapter contents.`;
	};

	getScripturesSuccess = function (chapterHtml) {
		document.getElementById(
			DIV_SCRIPTURES
		).innerHTML = `<div class="chapter-content my-3 shadow bg-superLight rounded px-3 pt-3 pb-6 w-11/12 text-dark">${chapterHtml}</div>`;

		// Add Tailwind classes to specific elements
		document.querySelectorAll('.chapterheading').forEach((element) => {
			element.classList.add('font-semibold', 'text-xl', 'mb-3');
		});

		document.querySelectorAll('.big').forEach((element) => {
			element.classList.add('font-extrabold', 'text-lg', 'mb-6');
		});

		document.querySelectorAll('.navheading').forEach((element) => {
			element.classList.add('font-bold', 'text-2xl', 'mb-6');
		});

		document.querySelectorAll('.divtitle').forEach((element) => {
			element.classList.add('inline-flex', 'border-b-4', 'border-dark');
		});

		document.querySelectorAll('.versesblock').forEach((element) => {
			element.classList.add('ml-1');
		});

		document.querySelectorAll('.versesblock li').forEach((element) => {
			element.classList.add('mb-2');
		});

		document.querySelectorAll('.verse').forEach((element) => {
			element.classList.add('font-bold');
		});

		resetMapPins(extractGeoplaces());
		setupPlaceLinkClickHandlers();
	};

	navigateBook = function (bookId) {
		let book = books[bookId];

		if (book.numChapters <= 1) {
			navigateChapter(bookId, book.numChapters);
		} else {
			document.getElementById(DIV_SCRIPTURES).innerHTML =
				chaptersGrid(book);

			updateBreadcrumbs(bookId); // Update breadcrumbs with bookId
		}
	};

	navigateChapter = function (bookId, chapter) {
		const book = books[bookId];
		const previousChapterButton =
			document.getElementById('previous-chapter');
		const nextChapterButton = document.getElementById('next-chapter');

		// Show or hide previous chapter button
		if (chapter > 1) {
			previousChapterButton.classList.remove('hidden');
		} else {
			previousChapterButton.classList.add('hidden');
		}

		// Show or hide next chapter button
		if (chapter < book.numChapters) {
			nextChapterButton.classList.remove('hidden');
		} else {
			nextChapterButton.classList.add('hidden');
		}

		// Update the hash in the URL
		const volumeId = findVolumeIdByBookId(bookId);
		location.hash = `${volumeId}:${bookId}:${chapter}`;

		ajax(
			encodedScripturesUrl(bookId, chapter),
			getScripturesSuccess,
			getScripturesFailure,
			true
		);

		updateBreadcrumbs(bookId, chapter); // Update breadcrumbs with bookId and chapter
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
		const placeLinks = document.querySelectorAll(
			"a[onclick^='showLocation']"
		);

		placeLinks.forEach(function (placeLink) {
			const onclickAttr = placeLink.getAttribute('onclick');
			// Split and clean up the onclick attribute to extract parameters
			const onclickArgs = onclickAttr
				.match(/showLocation\((.*?)\)/)[1]
				.split(',')
				.map((arg) => arg.trim().replace(/^'(.*)'$/, '$1'));
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
					text: geoplace.placename,
					// text: `${geoplace.placename} ${geoplace.longitude} ${geoplace.latitude}`,
				},
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
		google.maps.event.addListenerOnce(
			map,
			'bounds_changed',
			function (event) {
				if (this.getZoom() > 15) {
					// If the zoom level is too high (i.e., too zoomed in)
					this.setZoom(15); // Set a more "zoomed out" level
				}
			}
		);
	};

	function setupPlaceLinkClickHandlers() {
		const placeLinks = document.querySelectorAll(
			"a[onclick^='showLocation']"
		);
		placeLinks.forEach(function (link) {
			link.addEventListener('click', function (e) {
				e.preventDefault(); // Prevent the default action

				// Retrieve the unique key for the current location
				const onclickAttr = link.getAttribute('onclick');
				const onclickArgs = onclickAttr
					.match(/showLocation\((.*?)\)/)[1]
					.split(',')
					.map((arg) => arg.trim().replace(/^'(.*)'$/, '$1'));
				const [latitude, longitude] = [
					onclickArgs[2],
					onclickArgs[3],
				].map(Number);
				const key = `${latitude}|${longitude}`;

				// Check if the current location is the same as the last clicked location
				if (lastClickedLocation === key) {
					// If yes, alert the user that this location is already being displayed
					alert('That location is already being displayed.');
				} else {
					// If not, proceed to show the location and update the last clicked location
					if (mapPins && mapPins[key]) {
						const marker = mapPins[key];
						map.setCenter(marker.getPosition());
						map.setZoom(15); // Adjust zoom level as needed
						lastClickedLocation = key; // Update the last clicked location
					} else {
						// If we don't find a marker for the key, it might be useful to handle this case as well
						console.error(
							'Marker not found for the location:',
							key
						);
						// Optionally, reset lastClickedLocation if the marker doesn't exist
						// lastClickedLocation = null;
					}
				}
			});
		});
	}

	navigateHome = function (volumeId) {
		document.getElementById('scriptures').innerHTML = `${volumesGridContent(
			volumeId
		)}`;

		updateBreadcrumbs(undefined, undefined, volumeId); // Update breadcrumbs with volumeId
	};

	booksGrid = function (volume) {
		let gridContent = `<div class="books grid sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-y-3 ml-3">`; // Modify Book Grid Classes

		volume.books.forEach(function (book) {
			gridContent += `<a class="nav-animation inline-flex" id="${book.id}" href="#${volume.id}:${book.id}"><h4 class="rounded-full bg-secondary-400 text-light py-0.5 px-3 transition ease-in-out hover:bg-secondary-600 ease-in-out">${book.gridName}</h4></a>`;
		});

		return `${gridContent}</div>`;
	};

	function findVolumeIdByBookId(bookId) {
		let volumeId = null;
		volumes.forEach((volume) => {
			if (bookId >= volume.minBookId && bookId <= volume.maxBookId) {
				volumeId = volume.id;
			}
		});
		return volumeId;
	}

	chaptersGrid = function (book) {
		const volumeId = findVolumeIdByBookId(book.id);
		let gridContent = `<div class="my-3 shadow bg-superLight rounded px-3 pt-3 pb-6 w-11/12">`; // Match the style of the volumes grid
		gridContent += `<div class="volume w-full text-light text-lg font-semibold tracking-wide flex justify-start mb-3"><h3 class="rounded bg-primary-500 py-2 px-4 transition ease-in-out hover:bg-primary-600 ease-in-out cursor-pointer">${book.fullName}</h3></div>`; // Use the same classes for the book title
		gridContent += `<div class="books grid sm:grid-cols-1 md:grid-cols-3 xl:grid-cols-7 2xl:grid-cols-9 gap-y-3 ml-3">`; // Match the style of the books grid

		let chapter = 1;
		while (chapter <= book.numChapters) {
			gridContent += `<a class="nav-animation-chapter inline-flex" href="#${volumeId}:${book.id}:${chapter}"><h4 class="rounded-full bg-secondary-400 text-light py-0.5 px-3 transition ease-in-out hover:bg-secondary-600 ease-in-out">${chapter}</h4></a>`; // Use similar classes for the chapter buttons
			chapter += 1;
		}

		gridContent += `</div></div>`; // Close the books and container divs
		return gridContent;
	};

	volumesGridContent = function (volumeId) {
		let gridContent = '';

		volumes.forEach(function (volume) {
			if (volumeId === undefined || volumeId === volume.id) {
				gridContent += `<div class="my-3 shadow bg-superLight rounded px-3 pt-3 pb-6 w-11/12">`; // New container div with blank class
				gridContent += `<div class="volume w-full text-light text-lg font-semibold tracking-wide flex justify-start mb-3">${volumeTitle(
					volume
				)}</div>`; // Volume title with classes
				gridContent += booksGrid(volume); // Books grid
				gridContent += `</div>`; // Close the container div
			}
		});

		return gridContent;
	};

	volumeTitle = function (volume) {
		// Modify volume link
		return `<a href="#${volume.id}" class="nav-animation inline-flex"><h3 class="rounded bg-primary-500 py-2 px-4 transition ease-in-out hover:bg-primary-600 ease-in-out">${volume.fullName}</h3></a>`;
	};

	// Breadcrumbs Nav

	updateBreadcrumbs = function (bookId, chapter, volumeId) {
		let breadcrumbsContent = `<a href="#" onclick="Scriptures.navigateHome()" class="sm:mr-3 mr-1 transition ease-in-out hover:text-gray-500 ease-in-out">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
    <path fill-rule="evenodd" d="M9.293 2.293a1 1 0 0 1 1.414 0l7 7A1 1 0 0 1 17 11h-1v6a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-6H3a1 1 0 0 1-.707-1.707l7-7Z" clip-rule="evenodd" />
  </svg>
  </a>`; // Start with Home link

		if (bookId !== undefined) {
			let book = books[bookId];
			let volume = volumes.find(
				(volume) => volume.id === book.parentBookId
			);

			breadcrumbsContent += `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
            <path fill-rule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd" />
            </svg>
            <a href="#${volume.id}" onclick="Scriptures.navigateHome(${volume.id})" class="sm:mx-3 mx-1 transition ease-in-out hover:text-gray-500 ease-in-out">${volume.fullName}</a>`; // Add volume link

			if (chapter !== undefined) {
				breadcrumbsContent += `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
                <path fill-rule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd" />
                </svg>
                <a href="#${volume.id}:${bookId}" onclick="Scriptures.navigateBook(${bookId})" class="mx-1 sm:mx-3 transition ease-in-out hover:text-gray-500 ease-in-out">${book.gridName}</a>`; // Add book link
				breadcrumbsContent += `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
                <path fill-rule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd" />
                </svg>
                <a href="#${volume.id}:${bookId}:${chapter}" class="ml-3 transition ease-in-out hover:text-gray-500 ease-in-out">Chapter ${chapter}</a>`; // Add chapter link
			} else {
				breadcrumbsContent += `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
                <path fill-rule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd" />
                </svg>
                <a href="#${volume.id}:${bookId}" onclick="Scriptures.navigateBook(${bookId})" class="mx-1 sm:mx-3">${book.gridName}</a>`; // Add book link
			}
		} else if (volumeId !== undefined) {
			let volume = volumes.find((volume) => volume.id === volumeId);
			if (volume) {
				breadcrumbsContent += `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
                <path fill-rule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd" />
                </svg>
                <a href="#${volume.id}" onclick="Scriptures.navigateHome(${volume.id})" class="mx-3 transition ease-in-out hover:text-gray-500 ease-in-out">${volume.fullName}</a>`; // Add volume link
			}
		}

		document.getElementById(DIV_BREADCRUMBS).innerHTML = breadcrumbsContent; // Update breadcrumbs div
	};

	navigatePreviousChapter = function () {
		const [volumeId, bookId, chapter] = location.hash
			.slice(1)
			.split(':')
			.map(Number);
		if (chapter > 1) {
			navigateChapter(bookId, chapter - 1);
		}
	};

	navigateNextChapter = function () {
		const [volumeId, bookId, chapter] = location.hash
			.slice(1)
			.split(':')
			.map(Number);
		const book = books[bookId];
		if (chapter < book.numChapters) {
			navigateChapter(bookId, chapter + 1);
		}
	};

	// Public API --------------------------------------------------------

	onHashChanged = function (event) {
		let ids = [];

		if (location.hash !== '' && location.hash.length > 1) {
			ids = location.hash.slice(1).split(':');
		}

		const previousChapterButton =
			document.getElementById('previous-chapter');
		const nextChapterButton = document.getElementById('next-chapter');

		// Hide navigation buttons by default
		previousChapterButton.classList.add('hidden');
		nextChapterButton.classList.add('hidden');

		if (ids.length === 0) {
			navigateHome();
		} else if (ids.length === 1) {
			const volumeId = Number(ids[0]);
			navigateHome(volumeId);
		} else if (ids.length === 2) {
			const bookId = Number(ids[1]);
			navigateBook(bookId);
		} else if (ids.length === 3) {
			const bookId = Number(ids[1]);
			const chapter = Number(ids[2]);

			if (bookChapterValid(bookId, chapter)) {
				// Show navigation buttons for valid chapter
				if (chapter > 1) {
					previousChapterButton.classList.remove('hidden');
				}
				if (chapter < books[bookId].numChapters) {
					nextChapterButton.classList.remove('hidden');
				}

				navigateChapter(bookId, chapter);
			} else {
				navigateHome();
			}
		}
	};

	return {
		init,
		onHashChanged,
		navigateHome,
		navigateBook,
		navigateChapter,
		navigatePreviousChapter,
		navigateNextChapter,
	};
})();

// // Add the event listener for hash changes
// window.addEventListener('hashchange', Scriptures.onHashChanged);

// // Initialize the Scriptures module
// Scriptures.init();
