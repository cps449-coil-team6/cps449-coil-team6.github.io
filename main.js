let debounceTimeout;
let movieTitles = [];
const tmdbApiKey = "Bearer eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI1OWY3ODRhMzFiYWJjYTdmMzkzZmFhNTFlNjQxODNiNyIsIm5iZiI6MTc0NTYzMDk4MC4xNjk5OTk4LCJzdWIiOiI2ODBjMzcwNDVjMDNiNDYxZGY4NTdiODgiLCJzY29wZXMiOlsiYXBpX3JlYWQiXSwidmVyc2lvbiI6MX0.HYm28ET8JKA_-FPQq0AlH2DQy9eX5jPbv8If9Lf05Rc";

$(document).ready(function () {
$.get("https://coil-movies-app.azurewebsites.net/movielist", function (data) {
    movieTitles = data.movies.map(m => m.title);
});
});

function getRecommendations() {
    clearTimeout(debounceTimeout);
    
    debounceTimeout = setTimeout(() => {
        const query = $("#movie-input").val().trim();
        if (!query) {
            $("#recommendations").empty();
            $("#suggestions").empty();
            return;
        }

    // Autocomplete Suggestions
    const matches = movieTitles.filter(title =>
        title.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 5);

    if (matches.length > 0) {
        let suggestionHTML = "";
        matches.forEach(title => {
        suggestionHTML += `<div onclick="selectSuggestion('${title.replace(/'/g, "\\'")}')">${title}</div>`;
        });
        $("#suggestions").html(suggestionHTML).show();
    } else {
        $("#suggestions").empty();
    }

    let html = '<div class="row">';

    // Display the Searched Movie
    fetch(`https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(query)}`, {
        headers: {
        "Authorization": tmdbApiKey
        }
    })
    .then(response => response.json())
    .then(movieData => {
        const searchedMovie = movieData.results && movieData.results[0];
        if (searchedMovie) {
        const posterUrl = searchedMovie.poster_path
            ? `https://image.tmdb.org/t/p/w500${searchedMovie.poster_path}`
            : 'https://via.placeholder.com/300x450?text=No+Image';

        html += `
            <div class="col-sm-6 col-md-4">
            <div class="picture-card">
                <img src="${posterUrl}" alt="${searchedMovie.title}" style="width:100%; height:auto; border-radius:8px;">
                <h4>${searchedMovie.title}</h4>
            </div>
            </div>`;
        }

        // Fetch and Display Recommended Movies
        $.get(`https://coil-movies-app.azurewebsites.net/recommend/${query}`, function (data) {
            const recommendations = data.recommendations;
            if (recommendations.length === 0 || recommendations.error) {
                $("#recommendations").html("<p>No recommendations found.</p>");
                return;
            }

            recommendations.forEach(movie => {
                fetch(`https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(movie.title)}`, {
                    headers: {
                        "Authorization": tmdbApiKey
                    }
                })
                .then(response => response.json())
                .then(movieData => {
                    const result = movieData.results && movieData.results[0];
                    if (result) {
                        const posterUrl = result.poster_path
                        ? `https://image.tmdb.org/t/p/w500${result.poster_path}`
                        : 'https://via.placeholder.com/300x450?text=No+Image';

                        html += `
                        <div class="col-sm-6 col-md-4">
                            <div class="picture-card">
                            <img src="${posterUrl}" alt="${movie.title}" style="width:100%; height:auto; border-radius:8px;">
                            <h4>${movie.title}</h4>
                            </div>
                        </div>`;
                        $("#recommendations").html(html + '</div>');
                    }
                })
            .catch(err => {
                console.error("TMDB Fetch Error:", err);
            });
        });
        }).fail(function () {
            $("#recommendations").html("<p style='color:red;'>Failed to fetch recommendations.</p>");
        });
    })
    .catch(err => {
            console.error("TMDB Fetch Error:", err);
    });
    }, 0);
}

function selectSuggestion(title) {
    $("#movie-input").val(title);
    $("#suggestions").empty();
    getRecommendations();
}