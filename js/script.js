document.addEventListener('DOMContentLoaded', function () {
    // Получаем ссылку на элемент редактора кода
    const codeEditor = document.getElementById('codeEditor');

    // Интервал для автонабора
    let typeInterval;

    // Глобальный счетчик строк для непрерывной нумерации
    let globalLineCounter = 1;

    // УКАЖИТЕ ИМЯ ФАЙЛА ЗДЕСЬ
    const fileName = 'main.c';

    /**
     * Функция для экранирования HTML-символов
     * Преобразует специальные символы в HTML-сущности
     * @param {string} text - Текст для экранирования
     * @returns {string} Экранированный текст
     */
    function escapeHtml(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /**
     * Функция для подсветки синтаксиса C кода
     * Обрабатывает директивы препроцессора, комментарии и строки
     * @param {string} line - Строка кода для подсветки
     * @param {boolean} isInComment - Флаг нахождения внутри многострочного комментария
     * @returns {Object} Объект с HTML-кодом и состоянием комментария
     */
    function highlightLine(line, isInComment = false) {
        let escapedLine = escapeHtml(line);
        let newCommentState = isInComment;
        let result = escapedLine;

        // Обработка директив препроцессора (только для полных строк)
        if (line.trim().startsWith('#') && !isInComment) {
            result = '<span class="preprocessor">' + escapedLine + '</span>';
            return { html: result, inComment: false };
        }

        // Обработка многострочных комментариев
        if (isInComment) {
            // Уже находимся внутри многострочного комментария
            const endIndex = line.indexOf('*/');
            if (endIndex !== -1) {
                // Найден конец комментария на этой строке
                // Берем ВСЮ часть от начала строки до конца комментария ВКЛЮЧАЯ */
                const commentedPart = escapeHtml(line.substring(0, endIndex + 2));
                // Код после комментария (если есть)
                const remainingPart = escapeHtml(line.substring(endIndex + 2));
                result = '<span class="comment">' + commentedPart + '</span>' + remainingPart;
                newCommentState = false; // Выходим из режима комментария
            } else {
                // Конец комментария не найден - вся строка это комментарий
                result = '<span class="comment">' + escapedLine + '</span>';
            }
        } else {
            // Не внутри комментария - ищем начало новых комментариев

            // Сначала проверяем однострочные комментарии //
            const singleLineCommentIndex = line.indexOf('//');
            if (singleLineCommentIndex !== -1) {
                const codePart = escapeHtml(line.substring(0, singleLineCommentIndex));
                const commentPart = escapeHtml(line.substring(singleLineCommentIndex));
                result = codePart + '<span class="comment">' + commentPart + '</span>';
            } else {
                // Если нет однострочного комментария, ищем многострочные /* */
                const multiLineStartIndex = line.indexOf('/*');
                if (multiLineStartIndex !== -1) {
                    const codeBefore = escapeHtml(line.substring(0, multiLineStartIndex));
                    const commentSearch = line.substring(multiLineStartIndex);
                    const endIndex = commentSearch.indexOf('*/');

                    if (endIndex !== -1) {
                        // Комментарий начинается и заканчивается на этой строке
                        // Берем часть от /* до */ ВКЛЮЧАЯ оба символа */
                        const commentPart = escapeHtml(commentSearch.substring(0, endIndex + 2));
                        const codeAfter = escapeHtml(commentSearch.substring(endIndex + 2));
                        result = codeBefore + '<span class="comment">' + commentPart + '</span>' + codeAfter;
                    } else {
                        // Комментарий начинается на этой строке, но не заканчивается
                        const commentPart = escapeHtml(commentSearch);
                        result = codeBefore + '<span class="comment">' + commentPart + '</span>';
                        newCommentState = true; // Входим в режим комментария
                    }
                } else {
                    // Дополнительная проверка: если строка начинается с */ (неожиданное закрытие)
                    const endCommentIndex = line.indexOf('*/');
                    if (endCommentIndex !== -1) {
                        // Обрабатываем */ как комментарий (на случай ошибок в коде)
                        const commentPart = escapeHtml(line.substring(0, endCommentIndex + 2));
                        const remainingPart = escapeHtml(line.substring(endCommentIndex + 2));
                        result = '<span class="comment">' + commentPart + '</span>' + remainingPart;
                    } else {
                        // Нет комментариев в этой строке
                        result = escapedLine;
                    }
                }
            }
        }

        return { html: result, inComment: newCommentState };
    }

    /**
     * Основная функция автонабора кода
     * @param {string} content - Содержимое файла для автонабора
     */
    function startAutotyping(content) {
        // Если файл не загружен, используем пример кода
        if (!content) {
            content = [
                "/*",
                " * Многострочный комментарий",
                " * который занимает несколько строк",
                " */",
                "#include <stdio.h>",
                "#include <stdlib.h>",
                "#include <string.h>",
                "",
                "// Однострочный комментарий",
                "int main() {",
                "    printf(\"Hello, World!\\n\"); /* встроенный комментарий */",
                "    return 0;",
                "}"
            ].join('\n');
        }

        // Очищаем редактор
        codeEditor.innerHTML = '';

        // Разбиваем содержимое на строки
        const sourceCode = content.split('\n');

        // Текущая строка и символ
        let currentLine = 0;
        let currentChar = 0;

        // Максимальное количество видимых строк
        const maxLines = Math.floor(926 / 19);

        // Флаг нахождения внутри многострочного комментария
        let inComment = false;

        /**
         * Функция добавления одного символа
         */
        function addChar() {
            // Если весь код набран, перезапускаем через 2 секунды
            if (currentLine >= sourceCode.length) {
                clearInterval(typeInterval);
                setTimeout(() => {
                    globalLineCounter = 1; // Сбрасываем счетчик при перезапуске
                    startAutotyping(content);
                }, 2000);
                return;
            }

            // Если начинаем новую строку
            if (currentChar === 0) {
                const lineElement = document.createElement('div');
                lineElement.className = 'code-line';

                // Добавляем номер строки
                const lineNumber = document.createElement('span');
                lineNumber.className = 'line-number';
                lineNumber.textContent = globalLineCounter++;
                lineElement.appendChild(lineNumber);

                // Контейнер для кода
                const codeContent = document.createElement('span');
                codeContent.className = 'code-content';
                lineElement.appendChild(codeContent);

                codeEditor.appendChild(lineElement);

                // Удаляем первую строку если достигли максимума
                if (codeEditor.children.length > maxLines) {
                    codeEditor.removeChild(codeEditor.firstChild);
                }
            }

            const currentText = sourceCode[currentLine];
            const currentLineElement = codeEditor.lastChild;
            const codeContent = currentLineElement.querySelector('.code-content');

            // Добавляем символы по одному
            if (currentChar < currentText.length) {
                const newText = currentText.substring(0, currentChar + 1);
                const highlighted = highlightLine(newText, inComment);
                inComment = highlighted.inComment;

                codeContent.innerHTML = highlighted.html + '<span class="cursor"></span>';
                currentChar++;
            } else {
                // Завершаем текущую строку
                const highlighted = highlightLine(currentText, inComment);
                inComment = highlighted.inComment;
                codeContent.innerHTML = highlighted.html;

                // Переходим к следующей строке
                currentLine++;
                currentChar = 0;
            }
        }

        // Запускаем автонабор с интервалом 50ms
        clearInterval(typeInterval);
        typeInterval = setInterval(addChar, 50);
    }

    // Пробуем загрузить файл
    fetch(fileName)
        .then(response => response.ok ? response.text() : Promise.reject())
        .then(content => startAutotyping(content))
        .catch(() => startAutotyping());
});