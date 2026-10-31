// Разбор сообщений gfortran и подсказки на русском языке.
(function (root) {
  'use strict';

  const HINTS = [
    [/has no IMPLICIT type/i, 'Переменная не объявлена. При <code>implicit none</code> каждую переменную нужно объявить в начале программы, например <code>real :: x</code>. Проверьте и опечатки в имени.'],
    [/Unclassifiable statement/i, 'Компилятор не смог распознать оператор. Частые причины: опечатка в ключевом слове, пропущенная скобка или <code>::</code>, необъявленный массив, русская буква в имени.'],
    [/Expecting END (PROGRAM|SUBROUTINE|FUNCTION|MODULE)|Unexpected end of file/i, 'Не закрыт какой-то блок. Проверьте, что у каждого <code>do</code> есть <code>end do</code>, у <code>if (...) then</code> — <code>end if</code>, у <code>select case</code> — <code>end select</code>.'],
    [/Expecting END (DO|IF|SELECT)/i, 'Блок закрыт не тем оператором: например, внутри <code>do</code> стоит <code>end if</code>. Проверьте парность <code>do/end do</code> и <code>if/end if</code>.'],
    [/Unexpected (END|ELSE|CASE|CONTAINS)/i, 'Лишний или неуместный <code>end</code>/<code>else</code>. Возможно, блок уже закрыт выше, или <code>if</code> записан без <code>then</code>.'],
    [/Unexpected data declaration statement|Unexpected .*specification statement/i, 'Объявления переменных (<code>integer ::</code>, <code>real ::</code>) должны стоять в начале программы — до первых исполняемых операторов.'],
    [/already has basic type/i, 'Переменная объявлена дважды. Оставьте одно объявление.'],
    [/Rank mismatch|Incompatible ranks/i, 'Не совпадают размерности массивов: например, скаляр там, где ожидается массив, или массив 1D вместо 2D.'],
    [/Type mismatch in argument|Type mismatch/i, 'Типы аргумента не совпадают: например, передано целое <code>2</code> туда, где ожидается вещественное <code>2.0</code>, или <code>real</code> вместо <code>real(8)</code>.'],
    [/Integer division truncated/i, 'Деление целых чисел отбрасывает дробную часть: <code>1/2 = 0</code>. Если нужен дробный результат, пишите <code>1.0/2</code> или <code>real(n)/2</code>.'],
    [/Syntax error in (argument list|IF-expression|expression)/i, 'Синтаксическая ошибка в выражении: проверьте скобки, знаки операций и запятые. Сравнение — <code>==</code>, присваивание — <code>=</code>.'],
    [/Syntax error in (PRINT|WRITE|READ)/i, 'Ошибка в операторе ввода/вывода. Формат: <code>print *, a, b</code> или <code>write(*,*) a, b</code>, <code>read(*,*) a</code>.'],
    [/Syntax error in data declaration|Invalid character in name/i, 'Ошибка в объявлении или имени. Имена — только латиница, цифры и <code>_</code>, начинаются с буквы. Объявление: <code>real :: x, y</code>.'],
    [/Missing '\)'|Unbalanced parentheses|Expected a right parenthesis/i, 'Не хватает закрывающей скобки.'],
    [/Line truncated|Cannot read past end of line/i, 'Строка слишком длинная. Перенесите её с помощью <code>&amp;</code> в конце строки.'],
    [/Nonconforming tab character/i, 'В коде есть символы табуляции — замените их пробелами.'],
    [/is used uninitialized|may be used uninitialized/i, 'Переменная используется до того, как ей присвоили значение. Например, сумму нужно обнулить перед циклом: <code>s = 0.0</code>.'],
    [/Unused variable/i, 'Переменная объявлена, но не используется. Это не ошибка, а предупреждение.'],
    [/Function '(\w+)' at \(1\) has no IMPLICIT type/i, 'Функция не найдена: если это ваша функция, она должна быть в <code>contains</code> или в модуле; если встроенная — проверьте написание.'],
    [/Cannot open module file/i, 'Модуль не найден. Ячейка с модулем должна стоять выше и называться так же, как в <code>use</code>.'],
    [/Symbol '(\w+)' at \(1\) conflicts/i, 'Конфликт имён: переменная называется так же, как программа, функция или модуль.'],
    [/Non-numeric character in statement label|Invalid form of PROGRAM statement/i, 'Странный символ в начале строки или в заголовке. Проверьте первую строку: <code>program имя</code> (латиницей, без пробелов в имени).'],
    [/Expected array subscript|Unexpected array reference/i, 'Обращение к массиву с ошибкой: проверьте, что переменная объявлена как массив и индексы в круглых скобках.'],
    [/Array reference .* out of bounds|above upper bound|below lower bound/i, 'Выход за границы массива: индекс больше размера массива или меньше 1. Проверьте границы цикла <code>do</code>.'],
    [/End of file/i, 'Программа пыталась прочитать данные, но они закончились. Заполните поле «Ввод (stdin)» под ячейкой или проверьте файл с данными.'],
    [/Bad (integer|real|value|logical) /i, 'При чтении встретилось не то, что ожидалось: например, буква вместо числа, запятая вместо точки в дробном числе (<code>3,5</code> → <code>3.5</code>) или дробь при чтении в <code>integer</code>.'],
    [/Cannot open file|No such file or directory/i, 'Файл не найден. Добавьте его на панели «Файлы» (кнопка 📁 сверху) и проверьте имя.'],
    [/SIGFPE|Floating-point exception/i, 'Арифметическая ошибка: деление на ноль, переполнение или недопустимая операция (например, <code>sqrt</code> или <code>log</code> отрицательного числа).'],
    [/SIGSEGV|Segmentation fault/i, 'Обращение к недопустимой памяти. Частые причины: выход за границы массива, не выделенный (<code>allocate</code>) массив, бесконечная рекурсия.'],
    [/already allocated/i, 'Массив уже выделен. Перед повторным <code>allocate</code> нужен <code>deallocate</code>.'],
    [/not allocated|is not currently allocated/i, 'Массив не выделен: перед использованием allocatable-массива вызовите <code>allocate(a(n))</code>.'],
    [/Shape mismatch|Different shape/i, 'Не совпадают размеры массивов в выражении или присваивании.'],
    [/Nonnegative width required|Positive width required|Unexpected element|Expected .* in format/i, 'Ошибка в формате вывода. Пример корректного формата: <code>(A, F8.3, I5)</code>.'],
  ];

  function hintsFor(text) {
    const found = [];
    for (const [re, msg] of HINTS) {
      if (re.test(text) && !found.includes(msg)) found.push(msg);
      if (found.length >= 3) break;
    }
    return found;
  }

  // Извлекает номера строк с ошибками для конкретного файла
  function errorLines(output, fileName) {
    const lines = new Set();
    const re = /^([^\s:]+):(\d+):(\d+):\s*\n(?:[\s\S]*?)\n(Error|Warning|Fatal Error)/gm;
    let m;
    while ((m = re.exec(output)) !== null) {
      if (m[1] === fileName && m[4] !== 'Warning') lines.add(Number(m[2]));
    }
    // ошибки времени выполнения: "At line 5 of file main.f90"
    const rt = /At line (\d+) of file (\S+)/g;
    while ((m = rt.exec(output)) !== null) if (m[2] === fileName) lines.add(Number(m[1]));
    return [...lines];
  }

  root.Hints = { hintsFor, errorLines };
})(window);
