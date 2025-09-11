// Конфигурация
const API_TOKEN = '3794a7638b5863cc60d7b2b9274fa32e';
const API_URL = 'https://evloevfilmapi.vercel.app/api/list';

// Основная функция для получения данных
async function getMovies(params = {}) {
    try {
        console.log('Запрос к API с параметрами:', params);
        
        // Создаем URL
        const url = new URL(API_URL);
        url.searchParams.append('token', API_TOKEN);
        
        // Добавляем параметры
        Object.keys(params).forEach(key => {
            url.searchParams.append(key, params[key]);
        });

        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Ошибка HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Получены данные:', data);
        
        // Проверяем структуру ответа
        if (data.data && Array.isArray(data.data)) {
            console.log('Найдено фильмов:', data.data.length);
            return data.data; // Новый формат API
        } else if (Array.isArray(data.results)) {
            console.log('Найдено фильмов:', data.results.length);
            return data.results; // Старый формат API
        } else if (Array.isArray(data)) {
            console.log('Найдено фильмов:', data.length);
            return data; // Простой массив
        } else {
            console.warn('Неизвестный формат данных:', data);
            return [];
        }
        
    } catch (error) {
        console.error('Ошибка при получении данных:', error);
        throw error;
    }
}

// Функция отображения фильмов
function displayMovies(containerId, movies) {
    const container = document.getElementById(containerId);
    
    if (!movies || movies.length === 0) {
        container.innerHTML = '<div class="error">Фильмы не найдены</div>';
        return;
    }

    container.innerHTML = movies.map(movie => {
        // Извлекаем данные в зависимости от формата API
        const movieData = extractMovieData(movie);
        
        return `
            <div class="movie-card" onclick="openMovie('${String(movieData.id)}')">
                <img src="${movieData.poster}" 
                     alt="${movieData.title}"
                     onerror="this.src='https://via.placeholder.com/200x300?text=No+Image'">
                <div class="movie-info">
                    <div class="movie-title">${movieData.title}</div>
                    <div class="movie-year">${movieData.year} • Рейтинг: ${movieData.rating}</div>
                </div>
            </div>
        `;
    }).join('');

    // Кэшируем фильмы и МЕРДЖИМ с предыдущим кэшем, чтобы не терять другие разделы
    try {
        const newMap = {};
        movies.forEach(movie => {
            const m = extractMovieData(movie);
            if (m.id != null && m.id !== '') {
                newMap[String(m.id)] = movie;
            }
        });
        let merged = {};
        try {
            const prev = sessionStorage.getItem('lastRenderedMoviesMap');
            if (prev) merged = JSON.parse(prev) || {};
        } catch {}
        Object.assign(merged, newMap);
        window.lastRenderedMoviesMap = merged;
        sessionStorage.setItem('lastRenderedMoviesMap', JSON.stringify(merged));
    } catch (e) {
        console.warn('Не удалось сохранить кэш фильмов:', e);
    }
}

// Функция для извлечения данных фильма из разных форматов API
function extractMovieData(movie) {
    // Проверяем разные возможные форматы API
    return {
        id: movie.id || movie._id || Math.floor(Math.random() * 1000),
        title: movie.title || movie.name || movie.ru_name || 'Без названия',
        year: movie.year || movie.release_date || 'Год не указан',
        rating: movie.rating || movie.vote_average || movie.rate || 'Н/Д',
        poster: movie.poster || movie.poster_path || movie.image || 
                `https://via.placeholder.com/200x300?text=${encodeURIComponent(movie.title || 'Фильм')}`
    };
}

// Генерация тестовых фильмов для главной страницы
function createTestMovies(containerId, count, titlePrefix) {
    const container = document.getElementById(containerId);
    const movies = [];
    
    for (let i = 1; i <= count; i++) {
        movies.push({
            id: i,
            title: `${titlePrefix} ${i}`,
            year: 2020 + (i % 5),
            rating: (7 + (i % 3)).toFixed(1),
            poster: `https://via.placeholder.com/200x300/2c3e50/ffffff?text=${encodeURIComponent(titlePrefix)}+${i}`
        });
    }
    
    displayMovies(containerId, movies);
}

// Загрузка всех разделов
async function loadAllSections() {
    try {
        console.log('Начинаем загрузку данных...');
        
        // Загружаем популярные фильмы
        try {
            const popularMovies = await getMovies({
                type: 'films',
                limit: 8,
                sort: '-views'
            });
            displayMovies('popular-films', popularMovies);
        } catch (error) {
            console.warn('Ошибка загрузки популярных фильмов, используем тестовые данные');
            createTestMovies('popular-films', 8, 'Популярный');
        }

        // Загружаем драмы
        try {
            const dramaMovies = await getMovies({
                type: 'films',
                genre: 'drama',
                limit: 8
            });
            displayMovies('drama-films', dramaMovies);
        } catch (error) {
            console.warn('Ошибка загрузки драм, используем тестовые данные');
            createTestMovies('drama-films', 8, 'Драма');
        }

        // Загружаем комедии
        try {
            const comedyMovies = await getMovies({
                type: 'films',
                genre: 'comedy',
                limit: 8
            });
            displayMovies('comedy-films', comedyMovies);
        } catch (error) {
            console.warn('Ошибка загрузки комедий, используем тестовые данные');
            createTestMovies('comedy-films', 8, 'Комедия');
        }

        // Загружаем сериалы
        try {
            const series = await getMovies({
                type: 'serials',
                limit: 8,
                sort: '-year'
            });
            displayMovies('new-series', series);
        } catch (error) {
            console.warn('Ошибка загрузки сериалов, используем тестовые данные');
            createTestMovies('new-series', 8, 'Сериал');
        }

    } catch (error) {
        console.error('Общая ошибка загрузки:', error);
        
        // Создаем тестовые данные для всех разделов
        createTestMovies('popular-films', 8, 'Популярный');
        createTestMovies('drama-films', 8, 'Драма');
        createTestMovies('comedy-films', 8, 'Комедия');
        createTestMovies('new-series', 8, 'Сериал');
    }
}

// Функция для открытия страницы фильма
function openMovie(movieId) {
    try {
        // Если есть кэш — сохраняем текущий фильм для страницы movie.html
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

// Поиск из заголовка
function searchFromHeader() {
    const query = document.getElementById('header-search').value.trim();
    if (query) {
        window.location.href = `search.html?query=${encodeURIComponent(query)}`;
    } else {
        alert('Введите поисковый запрос');
    }
}

// Запускаем при загрузке страницы
window.addEventListener('DOMContentLoaded', function() {
    loadAllSections();
    
    // // Добавляем кнопку перезагрузки
    // const reloadButton = document.createElement('button');
    // reloadButton.textContent = '🔄 Перезагрузить страницу';
    // reloadButton.className = 'reload-button';
    // reloadButton.onclick = loadAllSections;
    // document.body.appendChild(reloadButton);
    
    // Поиск при нажатии Enter
    document.getElementById('header-search').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') searchFromHeader();
    });
});