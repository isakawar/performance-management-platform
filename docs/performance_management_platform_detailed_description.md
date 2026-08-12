# Performance Management Platform --- детальний опис

**Версія:** 0.1\
**Статус:** концепція / вимоги для подальшого опрацювання\
**Призначення документа:** описати бізнес-логіку, ролі, модулі та
основні сценарії платформи оцінювання і розвитку співробітників.

------------------------------------------------------------------------

## 1. Загальна концепція

Платформа призначена для побудови внутрішньої **Performance Management
Platform**, яка дозволяє регулярно або за запитом проводити оцінювання
співробітників, порівнювати самооцінку працівника з оцінкою його Lead,
виявляти розбіжності, визначати зони розвитку та використовувати
результати як один із факторів для перегляду професійного рівня /
грейду.

На першому етапі основним функціональним блоком є **Performance
Review**:

1.  HR або Lead створює / запускає оцінювання.
2.  Співробітник проходить самооцінювання.
3.  Після завершення самооцінювання Lead проходить незалежне оцінювання
    цього співробітника.
4.  Після завершення обох оцінювань система формує порівняння.
5.  Lead або HR може пошерити результат зі співробітником.
6.  Результати зберігаються в історії та можуть використовуватися для
    аналізу динаміки розвитку.

Платформа має бути спроєктована так, щоб у майбутньому до неї можна було
додати повноцінні функції Performance Management: development plans,
goals, feedback, career progression, promotion review, 1-on-1 та
командну аналітику.

------------------------------------------------------------------------

# 2. Основні цілі

## 2.1. Бізнес-цілі

Платформа повинна дозволити компанії:

-   стандартизувати процес оцінювання;
-   відмовитися від ручного ведення Excel-файлів;
-   зберігати історію оцінювань;
-   порівнювати самооцінку та оцінку Lead;
-   виявляти значні розбіжності у сприйнятті компетенцій;
-   визначати зони розвитку;
-   відслідковувати прогрес співробітника між review-періодами;
-   підтримувати перегляд грейду;
-   використовувати різні competency frameworks для різних
    спеціальностей;
-   централізовано керувати шаблонами анкет;
-   отримувати HR-аналітику по компанії, напрямках, командах та
    співробітниках.

## 2.2. Основна ідея

Система не повинна зводитися до простого середнього балу.

Основна цінність --- **порівняння двох незалежних оцінок**:

> Як співробітник бачить свій рівень\
> vs\
> Як його бачить Lead

Це дозволяє виявляти:

-   збіг оцінок;
-   переоцінку власного рівня;
-   недооцінку власного рівня;
-   конкретні компетенції з найбільшою розбіжністю;
-   потенційні зони розвитку;
-   потенційні підстави для перегляду грейду.

------------------------------------------------------------------------

# 3. Основні користувачі та ролі

Система повинна підтримувати RBAC (Role-Based Access Control) з
можливістю призначення користувачу декількох прав.

## 3.1. Employee

Звичайний співробітник.

Може:

-   авторизуватися через корпоративний SSO;
-   переглядати та редагувати власний профіль у дозволених межах;
-   обрати професійну роль;
-   обрати Lead;
-   бачити доступні йому Performance Reviews;
-   проходити самооцінювання;
-   зберігати незавершене оцінювання;
-   повертатися до нього пізніше;
-   після завершення переглядати власну самооцінку;
-   переглядати Lead Assessment і Difference лише після того, як
    результат був пошерений Lead або HR;
-   переглядати історію власних оцінювань.

Employee не може:

-   редагувати submitted самооцінювання;
-   змінювати оцінювання після Submit;
-   бачити оцінку Lead до моменту Share Result.

------------------------------------------------------------------------

## 3.2. Lead

Lead відповідає за оцінювання співробітників свого напряму.

Може:

-   бачити своїх співробітників;
-   запускати оцінювання за запитом;
-   проходити Lead Assessment;
-   зберігати незавершене оцінювання;
-   редагувати його до Submit;
-   після завершення переглядати порівняння Self vs Lead;
-   бачити історію оцінювань своїх співробітників;
-   аналізувати розбіжності;
-   додавати коментарі / evidence;
-   пошерити результат зі співробітником;
-   за необхідності ініціювати Reopen відповідно до правил доступу.

Lead може бути призначений для кількох співробітників.

Один Lead може бути відповідальним за кілька напрямків, якщо це
дозволено адміністрацією.

------------------------------------------------------------------------

## 3.3. HR

HR має розширені права щодо управління Performance Management.

Може:

-   бачити співробітників усієї компанії;
-   фільтрувати їх за напрямком, роллю, Lead, грейдом тощо;
-   створювати та запускати Performance Reviews;
-   переглядати результати;
-   бачити Self Assessment;
-   бачити Lead Assessment;
-   бачити Difference;
-   бачити історію оцінювань;
-   аналізувати результати команд;
-   керувати шаблонами анкет;
-   створювати нові анкети;
-   редагувати шаблони;
-   версіонувати анкети;
-   переглядати та аналізувати grade distribution;
-   пошерити результати зі співробітником;
-   за наявності відповідних прав --- повторно відкривати review.

------------------------------------------------------------------------

## 3.4. Admin

Admin --- системний адміністратор.

У системі передбачається один або декілька користувачів з
адміністративними правами в майбутньому, при цьому конкретні права
можуть комбінуватися.

Admin може:

-   керувати користувачами;
-   додавати користувачів за email;
-   призначати ролі;
-   призначати професійний напрямок;
-   призначати / дозволяти вибір Lead;
-   керувати грейдами;
-   керувати competency frameworks;
-   створювати та редагувати шаблони анкет;
-   створювати версії анкет;
-   керувати системними довідниками;
-   керувати правами;
-   переглядати результати;
-   виконувати адміністративні операції.

Права не повинні бути взаємовиключними.

Наприклад, один користувач може мати:

> HR + Lead

або:

> Admin + HR

або:

> Admin + Lead + HR

------------------------------------------------------------------------

# 4. Авторизація

## 4.1. SSO

Основний спосіб авторизації --- корпоративний SSO.

Користувач не повинен створювати окремий пароль для платформи.

## 4.2. Дозволені користувачі

Доступ дозволений тільки користувачам із корпоративною поштою:

`@racoongang.com`

Система повинна перевіряти корпоративний домен під час авторизації.

## 4.3. Попереднє наповнення бази

Адміністратор або імпорт можуть заздалегідь створити записи
користувачів.

Наприклад:

  Email                  Role       Direction   Lead
  ---------------------- ---------- ----------- -----------
  qa1@racoongang.com     Employee   QA          QA Lead 1
  qa2@racoongang.com     Employee   QA          QA Lead 2
  lead1@racoongang.com   Lead       QA          ---

Користувач може бути присутнім у БД ще до першого входу.

------------------------------------------------------------------------

# 5. First Login / Onboarding

Якщо користувач заходить у систему вперше, він проходить короткий
onboarding.

Можливі поля:

-   ім'я;
-   прізвище;
-   професійний напрямок;
-   роль / позиція;
-   поточний грейд;
-   Lead;
-   додаткова службова інформація.

Якщо для напрямку доступно кілька Lead, співробітнику може бути
показаний вибір:

> Select your Lead

При цьому Admin/HR повинні мати можливість змінити призначення пізніше.

Важливо: зміна профілю користувача не повинна змінювати історичні
Performance Reviews.

------------------------------------------------------------------------

# 6. Організаційна структура

Платформа повинна підтримувати структуру:

``` text
Company
 ├── Direction
 │    ├── Role
 │    │    ├── Lead
 │    │    └── Employees
 │    └── Competency Framework
 │
 └── Performance Reviews
```

Приклади напрямків:

-   QA
-   AQA
-   Development
-   BA
-   PM
-   Design
-   HR
-   інші.

Для кожного напрямку може бути свій competency framework та своя анкета.

------------------------------------------------------------------------

# 7. Грейди

Основна шкала, яка використовується в поточному Performance Profile:

1.  `UNWILLING`
2.  `JUNIOR`
3.  `JUNIOR+`
4.  `MIDDLE`
5.  `MIDDLE+`
6.  `SENIOR`
7.  `LEAD`

Для внутрішніх розрахунків рівням доцільно присвоїти числові значення:

  Grade         Numeric value
  ----------- ---------------
  UNWILLING                 0
  JUNIOR                    1
  JUNIOR+                   2
  MIDDLE                    3
  MIDDLE+                   4
  SENIOR                    5
  LEAD                      6

Числове значення є технічним і використовується для розрахунків.

У UI користувач бачить назву грейду та відповідний візуальний індикатор.

------------------------------------------------------------------------

# 8. Competency Framework

Анкета не повинна бути захардкоджена в коді.

Вона повинна будуватися з налаштовуваних сутностей:

``` text
Framework
 ├── Category
 │    ├── Competency
 │    │    ├── Description
 │    │    ├── Grade definitions
 │    │    ├── Weight
 │    │    ├── Evidence
 │    │    └── Comments
 │    └── ...
 └── ...
```

## 8.1. Категорії

Наприклад:

-   Hard Skills
-   Soft Skills
-   Domain Expertise
-   Leadership
-   Communication
-   Management

## 8.2. Competency

Приклад:

> Test Planning

Опис:

> The ability to strategize and organize the testing process...

Для кожного competency можуть бути задані очікування для кожного рівня.

Наприклад:

  Grade     Description
  --------- ----------------
  Junior    базовий рівень
  Junior+   ...
  Middle    ...
  Middle+   ...
  Senior    ...
  Lead      ...

Саме така модель уже використовується у наданому Performance Profile /
Skills Matrix.

------------------------------------------------------------------------

# 9. Шаблони анкет

HR/Admin повинні мати можливість створювати шаблони.

Наприклад:

-   QA Performance Profile;
-   AQA Performance Profile;
-   BA Performance Profile;
-   Developer Performance Profile;
-   PM Performance Profile.

Шаблон може містити:

-   назву;
-   опис;
-   напрямок;
-   категорії;
-   competencies;
-   descriptions;
-   grade descriptions;
-   weights;
-   порядок відображення;
-   правила оцінювання.

Шаблон можна зберігати та використовувати для нових Performance Reviews.

------------------------------------------------------------------------

# 10. Версійність анкет

Анкети повинні бути versioned.

Наприклад:

``` text
QA Framework
 ├── v1.0
 ├── v1.1
 └── v2.0
```

Якщо HR змінив competency framework, старе оцінювання не повинно
автоматично змінитися.

Наприклад:

> Performance Review Q1 2026 → QA Framework v1.0

навіть якщо зараз активна:

> QA Framework v2.0

Історичне оцінювання повинно залишатися прив'язаним до тієї версії, за
якою воно було проведене.

------------------------------------------------------------------------

# 11. Performance Review

Performance Review --- конкретний цикл оцінювання.

Приклад:

> QA Performance Review --- Q3 2026

Review має містити:

-   назву;
-   опис;
-   період;
-   framework;
-   framework version;
-   список учасників;
-   дедлайн;
-   статус;
-   дату створення;
-   дату завершення;
-   правила доступу.

Review може бути:

-   масовим;
-   для команди;
-   для конкретного співробітника.

------------------------------------------------------------------------

# 12. Запуск оцінювання

Review може бути створений:

### HR

Наприклад:

> Запустити QA Performance Review для всіх QA.

### Lead

Наприклад:

> Запустити review для конкретного співробітника.

### За запитом

Оцінювання може бути позаплановим.

Наприклад:

-   Lead хоче оцінити співробітника;
-   HR запускає оцінювання перед переглядом грейду;
-   співробітник переходить у нову роль.

------------------------------------------------------------------------

# 13. Статуси

Для Performance Review необхідно підтримати щонайменше:

-   `CREATED`
-   `IN_PROGRESS`
-   `WAITING_FOR_LEAD`
-   `COMPLETED`
-   `REOPENED`

Можлива розширена модель:

``` text
CREATED
   ↓
IN_PROGRESS
   ↓
WAITING_FOR_LEAD
   ↓
COMPLETED
   ↓
REOPENED
   ↓
IN_PROGRESS / WAITING_FOR_LEAD
```

## CREATED

Review створений, але оцінювання ще не почалось.

## IN_PROGRESS

Співробітник проходить самооцінювання.

## WAITING_FOR_LEAD

Self Assessment завершено та очікується оцінка Lead.

## COMPLETED

Self Assessment і Lead Assessment завершені.

## REOPENED

Завершене оцінювання повторно відкрите уповноваженим користувачем.

------------------------------------------------------------------------

# 14. Self Assessment

Співробітник отримує одну й ту саму анкету, яку пізніше використовує
Lead.

Приклад:

``` text
Competency:
Test Planning

Description:
...

Your assessment:
[ MIDDLE+ ]

Evidence:
[ текст ]
```

Співробітник може:

-   переміщатися між питаннями;
-   змінювати оцінку;
-   додавати evidence;
-   додавати коментарі;
-   зберігати draft;
-   повернутися пізніше.

Після натискання:

> Submit

оцінювання стає незмінним.

------------------------------------------------------------------------

# 15. Lead Assessment

Після завершення Self Assessment Lead отримує завдання оцінити
співробітника.

Lead бачить ту саму структуру competency framework.

Ключова вимога:

> Lead не повинен бачити Self Assessment співробітника до моменту, коли
> сам завершить свою оцінку.

Це необхідно для максимально незалежного оцінювання.

Після Submit Lead Assessment змінити його не можна, якщо review не був
спеціально reopened.

------------------------------------------------------------------------

# 16. Порівняння Self vs Lead

Після завершення двох оцінювань система формує результат.

Основна таблиця:

  Competency      Self Assessment   Lead Assessment   Difference
  --------------- ----------------- ----------------- ------------
  Test Planning   SENIOR            MIDDLE+           -1
  Test Design     MIDDLE+           MIDDLE            -1
  API Testing     MIDDLE            MIDDLE            0
  SQL             MIDDLE            MIDDLE+           +1

Difference рахується на основі внутрішніх numeric values.

Наприклад:

``` text
Self = SENIOR = 5
Lead = MIDDLE+ = 4

Difference = 4 - 5 = -1
```

------------------------------------------------------------------------

# 17. Інтерпретація Difference

Рекомендована модель:

     Difference Значення
  ------------- ----------------------
              0 повний збіг
        +1 / -1 невелика розбіжність
        +2 / -2 значна розбіжність
    +3 і більше критична розбіжність

У UI Difference має мати кольоровий індикатор.

Наприклад:

-   зелений --- збіг;
-   жовтий --- невелика розбіжність;
-   помаранчевий --- значна;
-   червоний --- критична.

Кольори повинні бути допоміжним індикатором, а не єдиним способом
передавання інформації.

------------------------------------------------------------------------

# 18. Загальний результат

Система повинна розраховувати Total.

Приклад:

``` text
Self Assessment
4.3 / 6

Lead Assessment
3.8 / 6

Difference
-0.5
```

Також повинні бути доступні результати по категоріях.

Наприклад:

``` text
Hard Skills
Self: 4.4
Lead: 3.9
Difference: -0.5

Soft Skills
Self: 4.1
Lead: 4.2
Difference: +0.1
```

Якщо competencies мають weight, Total повинен розраховуватися з
урахуванням ваг.

------------------------------------------------------------------------

# 19. Grade Distribution

На основі оцінювання можна формувати distribution.

Наприклад:

``` text
UNWILLING       0%
JUNIOR          5%
JUNIOR+         10%
MIDDLE          40%
MIDDLE+         30%
SENIOR          15%
LEAD            0%
```

Це може використовуватися для:

-   аналізу рівня команди;
-   аналізу рівня по напрямку;
-   порівняння Self vs Lead;
-   HR analytics.

------------------------------------------------------------------------

# 20. Grade Matrix

У наданому Performance Profile вже присутня концепція **Grade Matrix**,
яка враховує комбінацію Hard Skills та Soft Skills.

У платформі цю логіку доцільно зробити конфігурованою.

Наприклад:

``` text
Hard Skills + Soft Skills
        ↓
Recommended Grade
```

При цьому система може показувати:

-   поточний grade;
-   Self-derived level;
-   Lead-derived level;
-   рекомендований level;
-   grade before;
-   grade after.

Важливо: рекомендація системи не повинна автоматично означати підвищення
грейду.

Фінальне рішення залишається за відповідальною особою / процесом
компанії.

------------------------------------------------------------------------

# 21. Grade Before / Grade After

Performance Review може містити:

``` text
Grade before: MIDDLE
Grade after: MIDDLE+
```

`Grade before` фіксується на момент створення review або початку
оцінювання.

`Grade after` встановлюється після завершення review та прийняття
відповідного рішення.

Історичне значення не повинно змінюватися заднім числом.

------------------------------------------------------------------------

# 22. Evidence

Кожна competency може підтримувати Evidence.

Наприклад:

> Test Planning --- MIDDLE+

Evidence:

-   створив Test Plan для проєкту X;
-   проводив risk assessment;
-   самостійно планував regression scope;
-   оцінював тестові задачі.

Evidence допомагає зробити оцінювання обґрунтованим, а не суб'єктивним.

Для Lead Evidence особливо важливе при великій розбіжності між Self та
Lead.

------------------------------------------------------------------------

# 23. Коментарі

Для кожної competency доцільно передбачити коментарі.

Приклад:

``` text
Self:
"MIDDLE+ because I independently prepare test plans..."

Lead:
"MIDDLE. Can prepare plans independently, but risk
assessment still requires guidance."
```

Коментарі повинні бути частиною історії конкретного Assessment і не
змінюватися після Submit.

------------------------------------------------------------------------

# 24. Share Result

До моменту Share Result співробітник бачить тільки свою частину
оцінювання.

``` text
Employee view

Self Assessment      ✓
Lead Assessment      🔒
Difference           🔒
```

Після того як Lead або HR натиснув:

> **Share Result**

співробітнику стають доступні:

``` text
Self Assessment      ✓
Lead Assessment      ✓
Difference           ✓
Comments             ✓
```

Ця дія повинна фіксуватися в audit log:

-   хто пошерив;
-   коли;
-   який review;
-   який результат був опублікований.

------------------------------------------------------------------------

# 25. Історія

Для кожного співробітника повинна бути сторінка:

> Performance History

Приклад:

  Period    Grade Before     Self   Lead Grade After   Status
  --------- -------------- ------ ------ ------------- -----------
  Q1 2026   JUNIOR+           2.8    2.5 MIDDLE        Completed
  Q2 2026   MIDDLE            3.3    3.2 MIDDLE        Completed
  Q3 2026   MIDDLE            3.8    3.7 MIDDLE+       Completed

Це дозволяє бачити динаміку.

------------------------------------------------------------------------

# 26. Динаміка розвитку

Майбутня аналітика повинна дозволяти побачити:

-   як змінюється середня оцінка;
-   як змінюється оцінка окремої competency;
-   як змінюється gap між Self та Lead;
-   як змінюється grade;
-   які компетенції стабільно залишаються зонами розвитку.

Приклад:

``` text
API Testing
Q1 — MIDDLE
Q2 — MIDDLE+
Q3 — SENIOR
```

------------------------------------------------------------------------

# 27. HR Dashboard

HR Dashboard повинен давати загальний стан performance process.

Наприклад:

``` text
Performance Review — Q3 2026

Employees:          127
Completed:           93
In Progress:         18
Waiting for Lead:    11
Not Started:          5
```

Далі:

-   розподіл грейдів;
-   середній результат;
-   найбільші gaps;
-   результати по напрямках;
-   результати по Lead;
-   прогрес проходження review.

------------------------------------------------------------------------

# 28. Фільтри HR

HR повинен мати можливість фільтрувати дані за:

-   direction;
-   role;
-   grade;
-   Lead;
-   review;
-   period;
-   status;
-   employee;
-   competency;
-   результатом.

Наприклад:

``` text
Direction: QA
Lead: John Doe
Grade: MIDDLE
Review: Q3 2026
Status: Completed
```

------------------------------------------------------------------------

# 29. Lead Dashboard

Lead повинен бачити своїх співробітників.

Наприклад:

  Employee       Self   Lead    Gap Status
  ------------ ------ ------ ------ -----------
  Employee A      4.1    3.8   -0.3 Completed
  Employee B      3.4    ---    --- Waiting
  Employee C      3.8    3.9   +0.1 Completed

Також бажано мати сортування за найбільшою розбіжністю.

------------------------------------------------------------------------

# 30. Employee Dashboard

Employee бачить:

-   активний review;
-   статус;
-   deadline;
-   свою самооцінку;
-   доступний результат після Share;
-   історію.

Приклад:

``` text
Current Review
QA Performance Review — Q3 2026

Status: Waiting for Lead

Self Assessment: Completed
Lead Assessment: In progress
Result: Locked
```

------------------------------------------------------------------------

# 31. Admin Panel

Admin Panel повинна бути основним місцем конфігурації системи.

Основні розділи:

``` text
Dashboard

Users
Directions
Roles
Grades
Leads

Performance Reviews

Competency Frameworks
Questionnaires
Questionnaire Templates
Versions

Permissions
System Settings
Audit Log
```

------------------------------------------------------------------------

# 32. User Management

Admin/HR може:

-   додавати користувача;
-   деактивувати користувача;
-   переглядати email;
-   переглядати роль;
-   змінювати напрямок;
-   призначати Lead;
-   змінювати системні права;
-   переглядати історію.

Користувач не повинен отримувати доступ, якщо його email не відповідає
корпоративній політиці.

------------------------------------------------------------------------

# 33. Questionnaire Builder

Конструктор анкети має дозволяти без розробника створити нову анкету.

Приклад:

``` text
Create Questionnaire

Name:
QA Performance Profile

Direction:
QA

Categories:

1. Hard Skills
   ├── Test Planning
   ├── Test Design
   ├── Test Reporting
   ├── Issue Investigation
   ├── Work with Requirements
   ├── Work with Data
   ├── Tech Skills
   └── Automated Testing

2. Soft Skills
   ├── Communication
   ├── Responsibility
   ├── Collaboration
   └── Problem Solving
```

Для кожної competency:

-   name;
-   description;
-   grade definitions;
-   weight;
-   optional / required;
-   evidence;
-   comment;
-   order.

------------------------------------------------------------------------

# 34. Template System

HR може:

1.  створити questionnaire;
2.  зберегти його як template;
3.  використати template для нового review;
4.  створити нову версію;
5.  внести зміни;
6.  опублікувати нову версію.

Шаблон не повинен змінювати вже завершені reviews.

------------------------------------------------------------------------

# 35. Приклад QA Framework

Наданий файл Performance Profile містить Hard Skills та Soft Skills.

Серед прикладів Hard Skills:

-   Test Planning;
-   Test Design;
-   Test Reporting;
-   Test Management & Tool Proficiency + SDLC/STLC;
-   Issue Investigation;
-   Work with Requirements;
-   Work with Data;
-   Tech Skills;
-   Automated Testing;
-   Open edX Expertise.

Приклад Soft Skills:

-   Communication;
-   Responsibility;
-   Collaboration & Teamwork;
-   Problem Solving;
-   Stress Resistance;
-   Mentorship;
-   Delegation;
-   Independence;
-   Time Management;
-   General Attitude Toward Work;
-   Professional Self-Development.

Це не повинно бути жорстко закладено в систему. Це приклад framework,
який має бути імпортований / створений через конфігуратор.

------------------------------------------------------------------------

# 36. Інші професійні напрямки

Платформа повинна підтримувати окремі frameworks для:

-   QA;
-   AQA;
-   Developer;
-   BA;
-   PM;
-   інших напрямків.

Наприклад:

``` text
QA
 └── QA Framework v1.2

AQA
 └── AQA Framework v1.0

Developer
 └── Developer Framework v2.1

BA
 └── BA Framework v1.0
```

------------------------------------------------------------------------

# 37. Імпорт / експорт

Бажано передбачити імпорт framework з Excel/CSV.

Це особливо актуально, оскільки поточна модель оцінювання вже існує в
Excel.

Імпорт повинен дозволяти завантажити:

-   competencies;
-   descriptions;
-   grades;
-   grade descriptions;
-   categories;
-   weights.

Також бажано мати export результатів у Excel/CSV.

------------------------------------------------------------------------

# 38. Audit Log

Система повинна зберігати критичні дії.

Наприклад:

``` text
USER_CREATED
ROLE_CHANGED
LEAD_CHANGED
QUESTIONNAIRE_CREATED
QUESTIONNAIRE_UPDATED
QUESTIONNAIRE_VERSION_PUBLISHED
REVIEW_CREATED
SELF_ASSESSMENT_SUBMITTED
LEAD_ASSESSMENT_SUBMITTED
RESULT_SHARED
REVIEW_REOPENED
GRADE_CHANGED
```

Для кожної дії:

-   actor;
-   timestamp;
-   entity;
-   old value;
-   new value;
-   action.

------------------------------------------------------------------------

# 39. Ключові бізнес-правила

## BR-01

Доступ до системи --- тільки через корпоративний SSO.

## BR-02

Допустимий корпоративний домен --- `@racoongang.com`.

## BR-03

Один користувач може мати декілька системних ролей.

## BR-04

Один Lead може відповідати за багатьох Employees.

## BR-05

Employee може мати Lead і за необхідності змінювати його.

## BR-06

Зміна Lead не повинна змінювати історичні reviews.

## BR-07

Self Assessment та Lead Assessment використовують один
framework/version.

## BR-08

Lead не бачить Self Assessment до власного Submit.

## BR-09

Після Submit assessment не можна редагувати.

## BR-10

Незавершений assessment можна зберегти як draft.

## BR-11

Employee не бачить Lead Assessment до Share Result.

## BR-12

Після Share Result Employee отримує доступ до результатів.

## BR-13

Історичні reviews не повинні змінюватися після оновлення questionnaire
template.

## BR-14

Difference розраховується на основі внутрішнього numeric grade mapping.

## BR-15

Grade After не повинен змінюватися автоматично лише через результат
розрахунку.

------------------------------------------------------------------------

# 40. Основний user flow

``` text
Admin
  ↓
Creates Users
  ↓
Configures Directions / Roles / Leads
  ↓
Creates Questionnaire Template
  ↓
Publishes Questionnaire Version
  ↓
HR / Lead creates Performance Review
  ↓
Employee receives Review
  ↓
Employee completes Self Assessment
  ↓
Submit
  ↓
WAITING FOR LEAD
  ↓
Lead completes Lead Assessment
  ↓
Submit
  ↓
COMPLETED
  ↓
System calculates:
  - Self score
  - Lead score
  - Difference
  - Category scores
  - Total
  ↓
Lead / HR reviews result
  ↓
Share Result
  ↓
Employee sees comparison
  ↓
Result remains in history
```

------------------------------------------------------------------------

# 41. Future Performance Management Modules

Платформу бажано відразу проєктувати як основу для ширшої системи.

## 41.1. Development Plan

Після review можна створити:

``` text
Development Area:
API Testing

Current:
MIDDLE

Target:
SENIOR

Action:
Complete API automation course
Create API test framework
Mentoring sessions

Deadline:
Q4 2026
```

## 41.2. Goals

Співробітник та Lead можуть створювати цілі на наступний період.

## 41.3. Feedback

Можливість збирати feedback від колег.

## 41.4. Career Progression

Історія:

``` text
JUNIOR
  ↓
JUNIOR+
  ↓
MIDDLE
  ↓
MIDDLE+
  ↓
SENIOR
  ↓
LEAD
```

## 41.5. Promotion Review

Окремий процес перевірки готовності до переходу на наступний grade.

## 41.6. 1-on-1

Зберігання домовленостей та action items після регулярних зустрічей.

## 41.7. Skills Matrix

Візуальна карта компетенцій всієї команди.

------------------------------------------------------------------------

# 42. MVP

Для першої версії рекомендовано не реалізовувати всі майбутні модулі.

### MVP повинен включати:

-   SSO;
-   перевірку `@racoongang.com`;
-   User Management;
-   Roles & Permissions;
-   Directions;
-   Leads;
-   Employee onboarding;
-   Grade dictionary;
-   Questionnaire Builder;
-   Questionnaire Templates;
-   Questionnaire Versioning;
-   Performance Reviews;
-   Self Assessment;
-   Lead Assessment;
-   Draft saving;
-   Submit / lock;
-   Difference calculation;
-   Total calculation;
-   Grade Before / After;
-   Comments;
-   Evidence;
-   Share Result;
-   Employee History;
-   Lead Dashboard;
-   HR Dashboard;
-   Admin Panel;
-   Audit Log;
-   базові фільтри;
-   базову аналітику.

------------------------------------------------------------------------

# 43. Рекомендована структура даних

Концептуально система може складатися з таких сутностей:

``` text
User
Role
Permission
Direction
Grade
LeadAssignment

Questionnaire
QuestionnaireVersion
Category
Competency
CompetencyLevel
CompetencyWeight

PerformanceReview
ReviewParticipant

Assessment
AssessmentAnswer
AssessmentEvidence
AssessmentComment

ReviewResult
GradeDecision

DevelopmentPlan      // future
Goal                 // future
Feedback             // future
OneOnOne              // future

AuditLog
```

Ключовий принцип --- **не зберігати Performance Review просто як
посилання на поточну анкету**.

Review повинен фіксувати конкретну версію framework, яка була
використана.

------------------------------------------------------------------------

# 44. Приклад результату для співробітника

``` text
PERFORMANCE REVIEW
Q3 2026

Employee:
Vlad Bilobrov

Direction:
QA

Current Grade:
MIDDLE

Grade Before:
MIDDLE

--------------------------------

HARD SKILLS

Competency           Self    Lead    Difference
------------------------------------------------
Test Planning        SENIOR  MIDDLE+   -1
Test Design          MIDDLE+ MIDDLE    -1
Test Reporting       MIDDLE  MIDDLE     0
API Testing          MIDDLE+ SENIOR    +1
Automation           MIDDLE  MIDDLE     0

--------------------------------

SOFT SKILLS

Communication        SENIOR  SENIOR     0
Responsibility       SENIOR  MIDDLE+   -1
Collaboration        SENIOR  SENIOR     0

--------------------------------

TOTAL

Self Assessment: 4.2
Lead Assessment: 3.8
Difference: -0.4

--------------------------------

MAIN DEVELOPMENT AREAS

1. Test Planning
2. Test Design
3. Responsibility

--------------------------------

GRADE

Recommended: MIDDLE+
Final decision: MIDDLE+
```

------------------------------------------------------------------------

# 45. Важливий принцип щодо автоматичного грейду

Платформа може **розраховувати рекомендацію**, але не повинна
автоматично підвищувати грейд лише на основі середнього результату.

Причини:

-   різні competency можуть мати різну важливість;
-   окремі компетенції можуть бути критичними для конкретної ролі;
-   можуть існувати бізнес-вимоги;
-   grade decision може залежати від Lead та HR;
-   окремі випадки можуть потребувати додаткового review.

Тому правильна модель:

``` text
Assessment
      ↓
System Recommendation
      ↓
Lead / HR Review
      ↓
Final Grade Decision
```

------------------------------------------------------------------------

# 46. UX-принципи

Платформа повинна бути максимально простою для Employee.

Employee не повинен бачити складну HR-адмінку.

Для нього основний сценарій:

``` text
My Reviews
     ↓
Open Review
     ↓
Competencies
     ↓
Select Grade
     ↓
Add Evidence
     ↓
Save
     ↓
Submit
```

Lead отримує більше інформації.

HR отримує аналітичний інтерфейс.

Admin отримує конфігураційний інтерфейс.

------------------------------------------------------------------------

# 47. Основний принцип доступу до даних

Доступ повинен визначатися не тільки системною роллю, але й контекстом.

Наприклад:

**Employee**

> тільки власні reviews.

**Lead**

> reviews своїх підлеглих.

**HR**

> reviews усієї компанії.

**Admin**

> залежно від призначених permissions.

Це дозволить уникнути ситуації, коли будь-який користувач з роллю Lead
автоматично отримує доступ до всіх співробітників.

------------------------------------------------------------------------

# 48. Нотифікації

У майбутньому система повинна підтримувати notifications.

Події:

-   Review assigned;
-   Self Assessment reminder;
-   Self Assessment completed;
-   Waiting for Lead;
-   Lead Assessment reminder;
-   Review completed;
-   Result shared;
-   Review reopened;
-   Deadline approaching.

Канали:

-   email;
-   внутрішні notifications;
-   у майбутньому Slack / Teams.

------------------------------------------------------------------------

# 49. Non-functional requirements

## Security

-   SSO;
-   корпоративний domain restriction;
-   RBAC;
-   permission-based access;
-   audit log;
-   захист персональних даних;
-   secure session management.

## Data integrity

-   submitted assessment не можна змінити;
-   історичні reviews immutable;
-   questionnaire version immutable після використання;
-   зміна Lead не впливає на минулі reviews.

## Scalability

Система повинна підтримувати:

-   десятки;
-   сотні;
-   тисячі співробітників;

без зміни бізнес-логіки.

## Usability

Основний Employee flow повинен бути зрозумілим без навчання.

------------------------------------------------------------------------

# 50. Ключовий результат продукту

В результаті компанія отримує централізовану систему, у якій:

``` text
Employees
    ↓
Self Assessment
    ↓
Lead Assessment
    ↓
Comparison
    ↓
Gap Analysis
    ↓
Development Areas
    ↓
Grade Review
    ↓
Performance History
    ↓
Long-term Performance Management
```

Таким чином, платформа є не просто електронною анкетою, а основою для
системного управління професійним розвитком співробітників.

------------------------------------------------------------------------

# 51. Відкриті питання для наступного етапу

Нижче питання, які ще бажано затвердити перед переходом до детальної
технічної специфікації.

1.  Чи повинна система автоматично визначати рекомендований grade на
    основі Hard + Soft Skills?
2.  Чи `Junior+` та `Middle+` є повноцінними рівнями шкали?
3.  Чи всі competencies мають однакову вагу?
4.  Чи Evidence є обов'язковим для Lead?
5.  Чи коментар Lead обов'язковий при Difference \>= 2?
6.  Хто має право Reopen review?
7.  Що саме відбувається після Reopen?
8.  Чи потрібне підтвердження співробітника після Share Result?
9.  Чи потрібна можливість "I disagree" з оцінкою Lead?
10. Чи потрібен окремий Promotion Review?
11. Який SSO provider буде використовуватися?
12. Чи потрібен імпорт співробітників з CSV/Excel?
13. Чи потрібна інтеграція з HR/HRIS системою?
14. Чи потрібні email/Slack notifications у MVP?
15. Чи потрібен deadline для Self Assessment і Lead Assessment?
16. Чи може один employee мати більше одного Lead у межах одного review?
17. Чи може Lead оцінювати співробітника, який формально не закріплений
    за ним?
18. Чи повинні HR та Lead бачити повний текст Evidence співробітника?
19. Чи потрібно зберігати snapshots усіх відповідей та результатів?
20. Які правила прийняття фінального Grade After?

------------------------------------------------------------------------

# 52. Висновок

Основою системи є три сутності:

> **Employee → Self Assessment → Lead Assessment**

але кінцева цінність формується через:

> **Self vs Lead → Difference → Development Areas → Grade Review →
> History**

Архітектурно систему потрібно будувати не як одну фіксовану QA-анкету, а
як **конфігуровану платформу**, де HR/Admin може створювати різні
competency frameworks і questionnaire templates для QA, AQA, BA,
Developers та інших напрямків.

Поточний Excel Performance Profile є прикладом одного такого framework і
повинен розглядатися як **перший шаблон для перенесення в систему**, а
не як жорстко задана структура продукту.

Головний принцип продукту:

> **Оцінювання повинно бути структурованим, порівнюваним, історичним і
> придатним для прийняття рішень щодо професійного розвитку та
> кар'єрного росту.**
