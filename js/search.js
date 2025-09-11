const API_TOKEN = '3794a7638b5863cc60d7b2b9274fa32e';

// Проверяем параметры URL при загрузке
window.addEventListener('DOMContentLoaded', function() {
    const urlParams = new URLSearchParams(window.location.search);
    const query = urlParams.get('query');
    
    if (query) {
        document.getElementById('search-input').value = query;
        search();
    }
});

async function search() {
    const query = document.getElementById('search-input').value.trim();
    const type = document.getElementById('type-filter').value;
    const genre = document.getElementById('genre-filter').value;
    const year = document.getElementById('year-filter').value;

    if (!query) {
        alert('Пожалуйста, введите поисковый запрос');
        return;
    }

    // Показываем загрузку
    document.getElementById('search-results').innerHTML = `
        <div style="text-align: center; padding: 30px;">
            <div style="font-size: 18px;">🔍 Поиск...</div>
        </div>
    `;

    try {
        const params = {
            token: API_TOKEN,
            name: query,
            limit: 20
        };

        if (type) params.type = type;
        if (genre) params.genre = genre;
        if (year) params.year = year;

        const url = new URL('https://evloevfilmapi.vercel.app/api/list');
        Object.keys(params).forEach(key => {
            url.searchParams.append(key, params[key]);
        });

        const response = await fetch(url);
        const data = await response.json();
        let movies = [];
        if (Array.isArray(data)) {
            movies = data;
        } else if (Array.isArray(data.results)) {
            movies = data.results;
        } else if (Array.isArray(data.data)) {
            movies = data.data;
        } else if (data.items && Array.isArray(data.items)) {
            movies = data.items;
        } else {
            movies = [];
        }

        displaySearchResults(movies);

    } catch (error) {
        document.getElementById('search-results').innerHTML = `
            <div class="error">Ошибка поиска: ${error.message}</div>
        `;
    }
}

function displaySearchResults(movies) {
    const container = document.getElementById('search-results');
    
    if (!movies || movies.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 50px; color: #666;">
                😔 Ничего не найдено. Попробуйте другой запрос.
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <h3>Найдено: ${movies.length} результатов</h3>
        <div class="movies-grid">
            ${movies.map(movie => {
                const id = movie.id || movie._id || '';
                const title = movie.title || movie.name || 'Без названия';
                const poster = movie.poster || movie.poster_path || 'https://via.placeholder.com/200x300?text=No+Image';
                const year = movie.year || movie.release_date || 'Год не указан';
                const rating = movie.rating || movie.vote_average || 'Н/Д';
                return `
                <div class="movie-card" onclick="openMovie('${String(id)}')">
                    <img src="${poster}" 
                         alt="${title}"
                         style="width: 100%; height: 300px; object-fit: cover;"
                         onerror="this.src='https://via.placeholder.com/200x300?text=No+Image'">
                    <div class="movie-info">
                        <div class="movie-title">${title}</div>
                        <div class="movie-year">${year} • ${rating}</div>
                    </div>
                </div>
            `}).join('')}
        </div>
    `;

    // Кэш найденных фильмов для страницы фильма
    try {
        const map = {};
        movies.forEach(movie => {
            const id = movie.id || movie._id;
            if (id != null && id !== '') {
                map[String(id)] = movie;
            }
        });
        window.lastRenderedMoviesMap = map;
        sessionStorage.setItem('lastRenderedMoviesMap', JSON.stringify(map));
    } catch (e) {
        console.warn('Не удалось сохранить кэш фильмов (поиск):', e);
    }
}

function openMovie(movieId) {
    try {
        const idStr = String(movieId);
        let sourceMap = window.lastRenderedMoviesMap;
        if (!sourceMap) {
            const fromStorage = sessionStorage.getItem('lastRenderedMoviesMap');
            if (fromStorage) sourceMap = JSON.parse(fromStorage);
        }
        if (sourceMap && sourceMap[idStr]) {
            sessionStorage.setItem('currentMovie', JSON.stringify(sourceMap[idStr]));
        }
    } catch {}
    window.location.href = `movie.html?id=${encodeURIComponent(String(movieId))}`;
}

function goBack() {
    window.history.back();
}

// Поиск при нажатии Enter
document.getElementById('search-input').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') search();
});