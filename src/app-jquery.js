$('#next-chapter').click(function () {
	$('#scriptures').animate({ left: '-100%' }, 500, function () {
		$(this).css('left', '100%').animate({ left: '0' }, 500);
	});

	$('#map').animate({ bottom: '-100%' }, 500, function () {
		$(this).css('bottom', '100%').animate({ bottom: '0' }, 500);
	});
});

$('#previous-chapter').click(function () {
	$('#scriptures').animate({ left: '100%' }, 500, function () {
		$(this).css('left', '-100%').animate({ left: '0' }, 500);
	});

	$('#map').animate({ bottom: '100%' }, 500, function () {
		$(this).css('bottom', '-100%').animate({ bottom: '0' }, 500);
	});
});

$('#breadcrumbs-container p').click(function () {
	$('#scriptures')
		.css('z-index', '10') // Set a higher z-index during the animation
		.animate({ top: '100%' }, 500, function () {
			$(this)
				.css('top', '-100%')
				.animate({ top: '0' }, 500, function () {
					$(this).css('z-index', ''); // Reset z-index after animation
				});
		});
});

$(document).ready(function () {
	$('body').on('click', '.nav-animation-chapter', function () {
		$('#map')
			.css('z-index', '-1')
			.animate({ bottom: '100%' }, 500, function () {
				$(this)
					.css('bottom', '-100%')
					.animate({ bottom: '0' }, 500, function () {
						$(this).css('z-index', ''); // Reset z-index after animation
					});
			});
		$('#scriptures')
			.css('z-index', '-1')
			.animate({ top: '100%' }, 500, function () {
				$(this)
					.css('top', '-100%')
					.animate({ top: '0' }, 500, function () {
						$(this).css('z-index', ''); // Reset z-index after animation
					});
			});
	});
});

$(document).ready(function () {
	$('body').on('click', '.nav-animation', function () {
		$('#scriptures')
			.css('z-index', '-1')
			.animate({ top: '100%' }, 500, function () {
				$(this)
					.css('top', '-100%')
					.animate({ top: '0' }, 500, function () {
						$(this).css('z-index', ''); // Reset z-index after animation
					});
			});
	});
});
