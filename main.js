// GLOBAL VARIABLES
let debounceTimeout;
let movieTitles = [];
const tmdbApiKey = "Bearer eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI1OWY3ODRhMzFiYWJjYTdmMzkzZmFhNTFlNjQxODNiNyIsIm5iZiI6MTc0NTYzMDk4MC4xNjk5OTk4LCJzdWIiOiI2ODBjMzcwNDVjMDNiNDYxZGY4NTdiODgiLCJzY29wZXMiOlsiYXBpX3JlYWQiXSwidmVyc2lvbiI6MX0.HYm28ET8JKA_-FPQq0AlH2DQy9eX5jPbv8If9Lf05Rc";

// ON DOCUMENT READY
$(document).ready(function () {
    if (window.location.pathname.includes("movie.html")) {
        // If on movie details page, load movie info
        loadMovieDetailsPage();
        return;
    }
    // Fetch all movie titles for search suggestions
    $.get("https://coil-movies-app.azurewebsites.net/movielist", function (data) {
        movieTitles = data.movies.map(m => m.title);
    });
    // Show popular movies by default
    fetchPopularMovies();
    
    // If ENTER is pressed while typing in search box
    $("#movie-input").on("keydown", function (e) {
        if (e.key === "Enter") {
            const firstSuggestion = $("#suggestions div").first();
            if (firstSuggestion.length) {
                e.preventDefault();
                const selectedTitle = firstSuggestion.text();
                selectSuggestion(selectedTitle);
            }
        }
    });
});

// HANDLE SUGGESTIONS + RECOMMENDATIONS
function getRecommendations(isFromSelect = false) {
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
        const query = $("#movie-input").val().trim();
        $("#loading-spinner").show(); 
        $("#recommendations").empty();
        if (!query) {
            $("#suggestions").empty().hide();
            $("#recommendations").empty();
            fetchPopularMovies();
            return;
        }

        if (!isFromSelect) {
            // SHOW autocomplete suggestions
            const matches = movieTitles.filter(title =>
                title.toLowerCase().includes(query.toLowerCase())
            ).slice(0, 99);

            if (matches.length > 0) {
                let suggestionHTML = "";
                matches.forEach(title => {
                    suggestionHTML += `<div onclick="selectSuggestion('${title.replace(/'/g, "\\'")}')">${title}</div>`;
                });
                $("#suggestions").html(suggestionHTML).show();
            } else {
                $("#suggestions").empty().hide();
            }

            // Live TMDB Search (based on query)
            fetch(`https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(query)}`, {
                headers: {
                    "Authorization": tmdbApiKey
                }
            })
            .then(response => response.json())
            .then(data => {
                $("#loading-spinner").hide();
                const results = data.results || [];
                if (results.length === 0) {
                    $("#recommendations").html("<p style='color:red;'>No results found.</p>");
                    return;
                }

                // Render movie cards
                let html = '<div class="row">';
                results.slice(0, 12).forEach(movie => {
                    const posterUrl = movie.poster_path
                        ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
                        : 'https://via.placeholder.com/300x450?text=No+Image';
                    const voteAverage = movie.vote_average ?? 'N/A';

                    html += `
                        <div class="col-sm-6 col-md-4">
                            <div class="picture-card">
                                <img src="${posterUrl}" alt="${movie.title}" style="width:100%; height:auto; border-radius:8px;">
                                <h4>${movie.title}</h4>
                                <p>⭐ Rating: ${voteAverage}</p>
                                <a href="/views/movie.html?id=${movie.id}" class="btn btn-info" style="margin-top:10px;">More Info</a>
                            </div>
                        </div>`;
                });
                html += '</div>';
                $("#recommendations").html(html);
            })
            .catch(err => {
                console.error("Live search TMDB error:", err);
                $("#loading-spinner").hide();
                $("#recommendations").html("<p style='color:red;'>Failed to fetch results.</p>");
            });

        }   else {
                // If user selected a suggestion — fetch recommendations from both backend and TMDB
                $("#suggestions").empty().hide();
            
                let fullHtml = '<div class="row">';

                fetch(`https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(query)}`, {
                    headers: {
                        "Authorization": tmdbApiKey
                    }
                })
                .then(response => response.json())
                .then(movieData => {
                    $("#loading-spinner").hide();
                    const selectedMovie = movieData.results && movieData.results[0];
                    if (selectedMovie) {
                        const posterUrl = selectedMovie.poster_path
                            ? `https://image.tmdb.org/t/p/w500${selectedMovie.poster_path}`
                            : 'https://via.placeholder.com/300x450?text=No+Image';
                        const voteAverage = selectedMovie.vote_average ?? 'N/A';
            
                        fullHtml += `
                            <div class="col-sm-6 col-md-4">
                                <div class="picture-card">
                                    <img src="${posterUrl}" alt="${selectedMovie.title}" style="width:100%; height:auto; border-radius:8px;">
                                    <h4>${selectedMovie.title}</h4>
                                    <p>⭐ Rating: ${voteAverage}</p>
                                    <a href="/views/movie.html?id=${selectedMovie.id}" class="btn btn-info" style="margin-top:10px;">More Info</a>
                                </div>
                            </div>`;
                    }
                     // BACKEND recommendations based on title
                    $.get(`https://coil-movies-app.azurewebsites.net/recommend/${encodeURIComponent(query)}`, function (data) {
                        const recommendations = data.recommendations;
            
                        if (!recommendations || recommendations.length === 0 || recommendations.error) {
                            fullHtml += "<p style='color:red;'>No recommendations found.</p></div>";
                            $("#recommendations").html(fullHtml);
                            return;
                        }
                        // Fetch each recommended movie from TMDB
                        let fetchPromises = recommendations.map(movie => {
                            return fetch(`https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(movie.title)}`, {
                                headers: {
                                    "Authorization": tmdbApiKey
                                }
                            })
                            .then(response => response.json())
                            .then(movieData => {
                                $("#loading-spinner").hide();
                                const result = movieData.results && movieData.results[0];
                                if (result) {
                                    const posterUrl = result.poster_path
                                        ? `https://image.tmdb.org/t/p/w500${result.poster_path}`
                                        : 'https://via.placeholder.com/300x450?text=No+Image';
                                    const voteAverage = result.vote_average ?? 'N/A';
            
                                    fullHtml += `
                                        <div class="col-sm-6 col-md-4">
                                            <div class="picture-card">
                                                <img src="${posterUrl}" alt="${movie.title}" style="width:100%; height:100%; border-radius:8px;">
                                                <h4>${movie.title}</h4>
                                                <p>⭐ Rating: ${voteAverage}</p>
                                                <a href="/views/movie.html?id=${result.id}" class="btn btn-info" style="margin-top:10px;">More Info</a>

                                            </div>
                                        </div>`;
                                }
                            })
                            .catch(err => {
                                $("#loading-spinner").hide();
                                console.error("TMDB Fetch Error:", err);
                            });
                        });
            
                        Promise.all(fetchPromises).then(() => {
                            $("#loading-spinner").hide();
                            fullHtml += '</div>';
                            $("#recommendations").html(fullHtml);
                        });
            
                    }).fail(function () {
                        fullHtml += "<p style='color:red;'>Failed to fetch recommendations.</p></div>";
                        $("#recommendations").html(fullHtml);
                    });
            
                })
                .catch(err => {
                    $("#loading-spinner").hide();
                    console.error("TMDB Fetch Error:", err);
                    $("#recommendations").html("<p style='color:red;'>Failed to fetch selected movie.</p>");
                });
        }                   
    }, 200);
}


function fetchPopularMovies() {
    let html = '<div class="row">';

    $.get("https://coil-movies-app.azurewebsites.net/popular", function (data) {
        const popularMovies = data.populars;

        if (popularMovies.length === 0 || popularMovies.error) {
            $("#recommendations").html("<p>No popular movies found.</p>");
            return;
        }

        let fetchPromises = popularMovies.map(movie => {
            return fetch(`https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(movie.title)}`, {
                headers: {
                    "Authorization": tmdbApiKey
                }
            })
            .then(response => response.json())
            .then(movieData => {
                $("#loading-spinner").hide();
                let posterUrl = 'https://via.placeholder.com/300x450?text=No+Image';
                let title = movie.title;
                let voteAverage = movie.vote_average;

                const result = movieData.results && movieData.results[0];
                if (result && result.poster_path) {
                    posterUrl = `https://image.tmdb.org/t/p/w500${result.poster_path}`;
                }

                html += `
                    <div class="col-sm-6 col-md-4">
                        <div class="picture-card">
                        <img src="${posterUrl}" alt="${title}" style="width:100%; height:auto; border-radius:8px;">
                        <h4>${title}</h4>
                        <p>⭐ Rating: ${voteAverage}</p>
                        <a href="/views/movie.html?id=${result.id}" class="btn btn-info" style="margin-top:10px;">More Info</a>
                        </div>
                    </div>`;
            })
            .catch(err => {
                $("#loading-spinner").hide();
                console.error("TMDB Fetch Error:", err);
            });
        });

        Promise.all(fetchPromises).then(() => {
            $("#loading-spinner").hide();
            html += '</div>';
            $("#recommendations").html(html);
        });

    }).fail(function () {
        $("#recommendations").html("<p style='color:red;'>Failed to fetch popular movies.</p>");
    });
}

function selectSuggestion(title) {
    $("#movie-input").off('input');
    $("#movie-input").val(title);
    $("#suggestions").empty().hide();
    getRecommendations(true);
    setTimeout(() => {
        $("#movie-input").on('input', function () {
            getRecommendations(false);
        });
    }, 200);
}

/**
 * Load movie details and render to the movie.html view.
 * Also fetch and display cast members and recommended movies.
 */
function loadMovieDetailsPage() {
    const urlParams = new URLSearchParams(window.location.search);
    const movieId = urlParams.get('id');
    const tmdbApiKey = "Bearer eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI1OWY3ODRhMzFiYWJjYTdmMzkzZmFhNTFlNjQxODNiNyIsIm5iZiI6MTc0NTYzMDk4MC4xNjk5OTk4LCJzdWIiOiI2ODBjMzcwNDVjMDNiNDYxZGY4NTdiODgiLCJzY29wZXMiOlsiYXBpX3JlYWQiXSwidmVyc2lvbiI6MX0.HYm28ET8JKA_-FPQq0AlH2DQy9eX5jPbv8If9Lf05Rc";

    if (!movieId) {
        $("#movie-title").text("Invalid movie ID.");
        return;
    }

    $("#loading-spinner").show();
    // Fetch 
    Promise.all([
        fetch(`https://api.themoviedb.org/3/movie/${movieId}`, {
            headers: { Authorization: tmdbApiKey }
        }).then(res => res.json()),
        fetch(`https://api.themoviedb.org/3/movie/${movieId}/credits`, {
            headers: { Authorization: tmdbApiKey }
        }).then(res => res.json()),
        fetch(`https://api.themoviedb.org/3/movie/${movieId}/watch/providers`, {
            headers: { Authorization: tmdbApiKey }
        }).then(res => res.json()),
        fetch(`https://api.themoviedb.org/3/movie/${movieId}/videos`, {
            headers: { Authorization: tmdbApiKey }
        }).then(res => res.json())
    ])
    .then(([movie, credits, providers, videoData]) => {
        // Handle API error response
        if (!movie || movie.success === false) {
            $("#movie-title").text("Movie not found.");
            $("#loading-spinner").hide();
            return;
        }
        // Render basic movie info
        $("#movie-title").text(movie.title);
        const cast = credits.cast || [];
        const providerData = providers.results?.US || null;
        const trailer = videoData.results?.find(v => 
            v.site === "YouTube" && v.type === "Trailer"
        );
        
        if (trailer) {
            // Add click-to-play logic
            setTimeout(() => {
                $("#movie-poster").on("click", function () {
                    $("#poster-container").html(`
                        <iframe width="100%" height="315"
                            src="https://www.youtube.com/embed/${trailer.key}?autoplay=1"
                            title="YouTube trailer"
                            frameborder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowfullscreen
                            style="border-radius:8px; margin-bottom:20px;">
                        </iframe>
                    `);
                });
            }, 100); // allow DOM to render
        }

        let html = `
            <div class="row">
                <div class="col-sm-4 text-left">
                    <div id="poster-container">
                        <img 
                            src="https://image.tmdb.org/t/p/w500${movie.poster_path}" 
                            alt="${movie.title}" 
                            id="movie-poster"
                            style="width:100%; border-radius:8px; margin-bottom:20px; cursor:pointer;">
                    </div>

                </div>
                <div class="col-sm-8 text-left">
                    <h2>${movie.title}</h2>
                    <p><strong>Release Date:</strong> ${movie.release_date}</p>
                    <p><strong>Rating:</strong> ⭐ ${movie.vote_average}</p>
                    <p><strong>Runtime:</strong> ${movie.runtime} minutes</p>
                    <p><strong>Genres:</strong> ${movie.genres.map(g => g.name).join(", ")}</p>
                    <p><strong>Overview:</strong> ${movie.overview}</p>`;

        if (providerData) {
            html += `<div><strong>Available On:</strong> `;
            const allTypes = ['flatrate', 'rent', 'buy'];

            allTypes.forEach(type => {
                if (providerData[type]) {
                    html += `<p><em>${type.charAt(0).toUpperCase() + type.slice(1)}:</em> `;
                    providerData[type].forEach(p => {
                        html += `
                          <a href="${providerData.link}" target="_blank" style="display:inline-block;">
                            <img src="https://image.tmdb.org/t/p/w45${p.logo_path}" 
                                 alt="${p.provider_name}" 
                                 title="${p.provider_name}" 
                                 style="margin-right:6px;"/>
                          </a>`;
                      });
                    html += `</p>`;
                }
            });

            html += `</div>`;
        }

        // Display cast members if availabl
        if (cast.length > 0) {
            html += `
                <h3 style="margin-top:30px;">Cast</h3>
                <div class="cast-scroll" style="overflow-x:auto; white-space:nowrap; padding:10px 0 30px 0;">`;

            cast.slice(0, 99).forEach(actor => {
                const profileUrl = actor.profile_path
                    ? `https://image.tmdb.org/t/p/w500${actor.profile_path}`
                    : '/assets/unknown.png';

                html += `
                    <div class="cast-card">
                        <div class="picture-card">
                            <img src="${profileUrl}" alt="${actor.name}">
                            <h5 style="white-space:normal;">${actor.name}</h5>
                            <p>as ${actor.character}</p>
                        </div>
                    </div>`;
            });

            html += `</div>`; // Close cast scroll
        }
        // Add back button
        html += `
                <div style="margin-top:30px;">
                    <a href="/views/chatbox.html" class="btn btn-info">⬅ Back</a>
                </div>
                </div> <!-- end col-sm-8 -->
            </div> <!-- end row -->
        `;
        // Inject details into page
        $("#movie-details").html(html);
        $("#loading-spinner").hide();

        // Fetch recommendations using movie title
        fetch(`https://coil-movies-app.azurewebsites.net/recommend/${encodeURIComponent(movie.title)}`)
        .then(res => res.json())
        .then(data => {
            const rawRecs = data.recommendations;

            // If it's an error string or empty, stop here
            if (!rawRecs || typeof rawRecs === 'string' || rawRecs.error) {
            $("#recommendations").html("<p>No recommendations available for this movie.</p>");
            return;
            }

            // Normalize to array
            const recs = Array.isArray(rawRecs) ? rawRecs :
                        typeof rawRecs === 'object' ? Object.values(rawRecs) : [];

            // Filter out bad titles
            const validRecs = recs.filter(r => r && typeof r.title === 'string');

            if (!validRecs.length) {
            $("#recommendations").html("<p>No recommendations found.</p>");
            return;
            }

            let recHtml = `<h3 class="text-left" style="margin-top:50px;">Recommended Movies</h3>`;
            recHtml += `<div class="row">`;

            const fetches = validRecs.slice(0, 12).map(async rec => {
            try {
                const response = await fetch(`https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(rec.title)}`, {
                headers: { Authorization: tmdbApiKey }
                });
                const tmdbData = await response.json();

                const result = tmdbData.results?.find(r =>
                r?.title?.toLowerCase() === rec.title.toLowerCase()
                ) || tmdbData.results?.[0];

                if (!result) return '';

                const posterUrl = result.poster_path
                ? `https://image.tmdb.org/t/p/w500${result.poster_path}`
                : '/assets/unknown.png';

                return `
                <div class="col-sm-6 col-md-4">
                    <div class="picture-card">
                    <img src="${posterUrl}" alt="${result.title}" style="width:100%; height:auto; border-radius:8px;">
                    <h4>${result.title}</h4>
                    <p>⭐ Rating: ${result.vote_average ?? 'N/A'}</p>
                    <a href="/views/movie.html?id=${result.id}" class="btn btn-info" style="margin-top:10px;">More Info</a>
                    </div>
                </div>`;
            } catch (err) {
                console.error(`Failed to fetch TMDB data for:`, rec, err);
                return '';
            }
            });

            Promise.all(fetches).then(cards => {
            recHtml += cards.filter(Boolean).join('') + '</div>';
            $("#recommendations").html(recHtml);
            });
        })
        .catch(err => {
            console.error("Failed to fetch recommendations:", err);
            $("#recommendations").html("<p>Could not load recommendations.</p>");
        });

    });
}

