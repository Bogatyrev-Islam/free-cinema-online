const API_TOKEN = '3794a7638b5863cc60d7b2b9274fa32e';

// Получаем ID из URL
function getMovieId() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('id');
}

// Основная функция загрузки
async function loadMovie() {
    const movieId = getMovieId();
    
    if (!movieId) {
        showError('Фильм не найден');
        return;
    }

    try {
        // 1) Сначала пробуем взять из sessionStorage (кэш из списка/поиска)
        let cached = null;
        try {
            const fromStorage = sessionStorage.getItem('currentMovie');
            if (fromStorage) {
                const parsed = JSON.parse(fromStorage);
                if (parsed && (String(parsed.id) === String(movieId) || String(parsed._id) === String(movieId))) {
                    cached = parsed;
                }
            }
            if (!cached) {
                const mapStr = sessionStorage.getItem('lastRenderedMoviesMap');
                if (mapStr) {
                    const map = JSON.parse(mapStr);
                    cached = map && map[String(movieId)];
                }
            }
        } catch {}

        if (cached) {
            displayMovie(cached);
            const genre = cached.genre || (cached.genres && (Array.isArray(cached.genres) ? cached.genres[0] : Object.values(cached.genres)[0])) || '';
            loadSimilarMovies(genre);
            return;
        }

        // 2) Если нет кэша — запрос к API и поиск по страницам, переходя по next_page
        let pageUrl = `https://evloevfilmapi.vercel.app/api/list?token=${API_TOKEN}`;
        let movieData = null;
        let guard = 0;
        while (pageUrl && guard < 10 && !movieData) {
            const resp = await fetch(pageUrl);
            if (!resp.ok) throw new Error('API не доступен');
            const data = await resp.json();
            console.log('Данные от API:', data);
            let items = [];
            if (Array.isArray(data)) items = data;
            else if (data && Array.isArray(data.results)) items = data.results;
            else if (data && Array.isArray(data.data)) items = data.data;

            movieData = items.find(item => String(item.id) === String(movieId) || String(item._id) === String(movieId)) || null;

            // Переходим на следующую страницу, если не нашли
            pageUrl = movieData ? null : (data && data.next_page ? data.next_page : null);
            guard++;
        }

        if (movieData) {
            displayMovie(movieData);
            const genre = movieData.genre || (movieData.genres && (Array.isArray(movieData.genres) ? movieData.genres[0] : Object.values(movieData.genres)[0])) || '';
            loadSimilarMovies(genre);
        } else {
            // Не нашли в списке — показываем минимальную карточку, но даём возможность смотреть по iframe
            const fallback = { id: movieId, title: `Фильм #${movieId}`, year: 'Не указан', rating: 'Н/Д', genre: 'Не указан', description: 'Видео загружается напрямую из плеера.', poster: `https://via.placeholder.com/300x450?text=ID%20${encodeURIComponent(String(movieId))}`, type: 'film' };
            displayMovie(fallback);
        }
    } catch (error) {
        console.error('Ошибка:', error);
        showError('Не удалось загрузить фильм: ' + error.message);
    }
}

// Отображение информации о фильме
function displayMovie(movie) {
    const container = document.getElementById('movie-container');
    
    // Извлекаем данные в правильном формате
    const rawTitle = movie.title || movie.name || movie.origin_name || `Фильм #${movie.id || movie._id || ''}`;
    const rawPoster = movie.poster || movie.poster_path || movie.cover || movie.image;
    const genresValue = movie.genre || movie.genres || null;
    const firstGenre = Array.isArray(genresValue)
        ? genresValue[0]
        : (genresValue && typeof genresValue === 'object')
            ? Object.values(genresValue)[0]
            : genresValue;
    let desc = movie.description || movie.overview || movie.plot || movie.storyline || '';
    if (!desc) {
        const parts = [];
        if (movie.type) parts.push(movie.type === 'series' ? 'Сериал' : 'Фильм');
        if (movie.quality) parts.push(`Качество: ${movie.quality}`);
        if (movie.year) parts.push(`Год: ${movie.year}`);
        if (firstGenre) parts.push(`Жанр: ${firstGenre}`);
        desc = parts.length ? parts.join(' • ') : 'Описание отсутствует';
    }
    const posterUrl = rawPoster || `https://via.placeholder.com/300x450?text=${encodeURIComponent(rawTitle || 'Фильм')}`;

    const movieInfo = {
        id: movie.id || movie._id || '',
        title: rawTitle,
        year: movie.year || movie.release_date || 'Не указан',
        rating: movie.rating || movie.vote_average || 'Н/Д',
        genre: firstGenre || 'Не указан',
        description: desc,
        poster: posterUrl,
        video_url: movie.video_url || movie.stream_url || null,
        iframe_url: movie.iframe_url || null,
        type: movie.type || 'film'
    };

    container.innerHTML = `
        <div class="movie-header">
            <div class="movie-poster">
                <img src="${movieInfo.poster}" 
                     alt="${movieInfo.title}"
                     onerror="this.src='https://via.placeholder.com/300x450?text=No+Image'">
            </div>
            
            <div class="movie-info">
                <h1 class="movie-title">${movieInfo.title}</h1>
                
                <div class="movie-meta">
                    <span class="meta-item">📅 ${movieInfo.year}</span>
                    <span class="meta-item">⭐ ${movieInfo.rating}/10</span>
                    <span class="meta-item">🎭 ${movieInfo.genre}</span>
                    ${movieInfo.type === 'serial' ? '<span class="meta-item">📺 Сериал</span>' : ''}
                </div>

                <div class="movie-description">
                    <h3>Описание</h3>
                    <p>${movieInfo.description}</p>
                </div>

                <button class="watch-btn" onclick="setupPlayer('${String(movieInfo.id)}')">
                    ▶️ Смотреть ${movieInfo.type === 'serial' ? 'сериал' : 'фильм'}
                </button>
            </div>
        </div>
    `;

    // Сохраняем данные для плеера
    window.currentMovie = movieInfo;
}

// Настройка плеера
async function setupPlayer(movieId) {
    try {
        // 0) Если есть данные из displayMovie
        if (window.currentMovie) {
            const cm = window.currentMovie;
            const title = cm.title || cm.name || `Видео #${movieId}`;
            if (cm.iframe_url) {
                playIframe(cm.iframe_url, title);
                return;
            }
            if (cm.video_url || cm.stream_url) {
                playMovie(cm.video_url || cm.stream_url, title);
                return;
            }
        }
        // Ищем фильм по страницам, переходя по next_page
        let pageUrl = `https://evloevfilmapi.vercel.app/api/list?token=${API_TOKEN}`;
        let movieData = null;
        let guard = 0;
        while (pageUrl && guard < 20 && !movieData) {
            const response = await fetch(pageUrl);
            const data = await response.json();
            if (Array.isArray(data)) {
                movieData = data.find(item => String(item.id) === String(movieId) || String(item._id) === String(movieId));
            } else if (data && Array.isArray(data.data)) {
                movieData = data.data.find(item => String(item.id) === String(movieId) || String(item._id) === String(movieId));
            } else if (data && Array.isArray(data.results)) {
                movieData = data.results.find(item => String(item.id) === String(movieId) || String(item._id) === String(movieId));
            }
            pageUrl = movieData ? null : (data && data.next_page ? data.next_page : null);
            guard++;
        }

        if (movieData && (movieData.iframe_url || movieData.video_url || movieData.stream_url)) {
            const title = movieData.title || movieData.name || 'Видео';
            // Обновим карточку, если ранее была минимальная
            try {
                const wasPlaceholder = window.currentMovie && (
                    (window.currentMovie.title && /^Фильм #/.test(window.currentMovie.title)) ||
                    (window.currentMovie.poster && /placeholder\.com/.test(window.currentMovie.poster)) ||
                    (window.currentMovie.description && window.currentMovie.description.indexOf('Описание отсутствует') !== -1)
                );
                if (!window.currentMovie || wasPlaceholder) {
                    displayMovie(movieData);
                }
            } catch {}
            if (movieData.iframe_url) {
                playIframe(movieData.iframe_url, title);
            } else {
                playMovie(movieData.video_url || movieData.stream_url, title);
            }
        } else {
            // 3) Фоллбэк: пробуем известные iframe-урлы по ID
            const guessMovie = `https://api.namy.ws/embed/movie/${encodeURIComponent(String(movieId))}`;
            const guessSeries = `https://api.namy.ws/embed/series/${encodeURIComponent(String(movieId))}`;
            // По умолчанию пробуем movie
            playIframe(guessMovie, `Видео #${movieId}`);
            // Дополнительно подготовим переключение на series, если нужно (невозможно проверить CORS-ошибку загрузки, но пользователь сможет вручную обновить)
        }

    } catch (error) {
        console.error('Ошибка загрузки видео:', error);
        showPlayerMessage('Ошибка загрузки видео');
    }
}

// Воспроизведение видео
function playMovie(videoUrl, title) {
    const placeholder = document.getElementById('player-placeholder');
    const videoContainer = document.getElementById('video-container');
    const playerTitle = document.getElementById('player-title');
    
    placeholder.style.display = 'none';
    videoContainer.style.display = 'block';
    playerTitle.textContent = title;

    // Используем video элемент
    const videoPlayer = document.getElementById('video-player');
    const iframe = document.getElementById('iframe-player');
    if (iframe) {
        iframe.removeAttribute('src');
        iframe.style.display = 'none';
    }
    videoPlayer.src = videoUrl;
    videoPlayer.style.display = 'block';
    videoPlayer.load();
    
    // Пытаемся запустить автоматически
    videoPlayer.play().catch(e => {
        console.log('Автовоспроизведение заблокировано');
    });
}

// Воспроизведение через iframe
function playIframe(iframeUrl, title) {
    const placeholder = document.getElementById('player-placeholder');
    const videoContainer = document.getElementById('video-container');
    const playerTitle = document.getElementById('player-title');
    
    placeholder.style.display = 'none';
    videoContainer.style.display = 'block';
    playerTitle.textContent = title;

    const videoPlayer = document.getElementById('video-player');
    const iframe = document.getElementById('iframe-player');
    if (videoPlayer) {
        try { videoPlayer.pause(); } catch {}
        videoPlayer.removeAttribute('src');
        videoPlayer.style.display = 'none';
    }
    iframe.src = iframeUrl;
    iframe.style.display = 'block';
}

// Показать сообщение в плеере
function showPlayerMessage(message) {
    const placeholder = document.getElementById('player-placeholder');
    const videoContainer = document.getElementById('video-container');
    
    placeholder.style.display = 'none';
    videoContainer.style.display = 'block';
    videoContainer.innerHTML = `
        <div class="player-message">
            <div style="text-align: center; padding: 50px;">
                <div style="font-size: 48px; margin-bottom: 20px;">🎬</div>
                <h3>${message}</h3>
                <p style="color: #888; margin-top: 20px;">
                    Попробуйте позже или выберите другой фильм
                </p>
            </div>
        </div>
    `;
}

// Загрузка похожих фильмов
async function loadSimilarMovies(genre) {
    try {
        const url = new URL('https://evloevfilmapi.vercel.app/api/list');
        url.searchParams.set('token', API_TOKEN);
        if (genre) url.searchParams.set('genre', genre);
        url.searchParams.set('limit', '6');
        const response = await fetch(url);
        const data = await response.json();
        
        const movies = Array.isArray(data) ? data : (data.data || data.results || data.items || []);
        displaySimilarMovies(movies.slice(0, 6));
        
    } catch (error) {
        console.error('Ошибка загрузки похожих фильмов:', error);
        document.getElementById('similar-container').innerHTML = '<div>Не удалось загрузить похожие фильмы</div>';
    }
}

// Отображение похожих фильмов
function displaySimilarMovies(movies) {
    const container = document.getElementById('similar-container');
    
    if (!movies || movies.length === 0) {
        container.innerHTML = '<div>Похожие фильмы не найдены</div>';
        return;
    }

    container.innerHTML = movies.map(movie => {
        const title = movie.title || movie.name || 'Без названия';
        const poster = movie.poster || movie.poster_path || 'https://via.placeholder.com/150x225?text=No+Image';
        const year = movie.year || movie.release_date || 'Не указан';
        const id = movie.id || movie._id || '';
        return `
            <div class="similar-item" onclick="openMovie('${String(id)}')">
                <img src="${poster}" 
                     alt="${title}"
                     onerror="this.src='https://via.placeholder.com/150x225?text=No+Image'">
                <div class="similar-title">${title}</div>
                <div class="similar-year">${year}</div>
            </div>
        `;
    }).join('');
}

function openMovie(movieId) {
    window.location.href = `movie.html?id=${encodeURIComponent(String(movieId))}`;
}

function goBack() {
    window.history.back();
}

function showError(message) {
    document.getElementById('movie-container').innerHTML = `
        <div class="error">
            <h2>😔 Ошибка</h2>
            <p>${message}</p>
            <button onclick="goBack()">Вернуться назад</button>
        </div>
    `;
}

// Запускаем при загрузке страницы
window.addEventListener('DOMContentLoaded', loadMovie);