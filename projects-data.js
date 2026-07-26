/* Church projects data (Payload collection → projects). Shared by projects.dc.html + project.dc.html.
   Placeholder content — replace with the church's real, current projects. */
window.HOB_PROJECTS = [
  {
    id: "prayer-house-build",
    title: "Будівництво молитовного дому",
    category: "Будівництво",
    status: "Збір коштів",
    period: "2025 – триває",
    date: "2026-01-20",
    lead: "Будуємо новий молитовний дім, який зможе прийняти зростаючу спільноту та стане центром служіння для всього району.",
    body: "Наша громада виросла з невеликого зібрання до сотень людей, і нинішнє приміщення вже не вміщує всіх бажаючих. Проєкт передбачає будівництво нового молитовного дому з залом на 500 місць, приміщеннями для дитячого й молодіжного служіння та простором для соціальних ініціатив. Будівництво ведеться поетапно, у міру надходження пожертв — кожна гривня наближає нас до завершення.",
    stats: [{n:"38%", l:"зібрано коштів"}, {n:"420 м²", l:"площа будівлі"}, {n:"3", l:"поверхи"}, {n:"2027", l:"плановий рік завершення"}],
    progress: {percent: 38, raised: "1 140 000 грн", goal: "3 000 000 грн"},
    cta: {label:"Підтримати будівництво", url:"https://www.liqpay.ua/uk/checkout/donatedh"},
    en: {
      title: "Prayer House Construction",
      category: "Construction",
      status: "Fundraising",
      period: "2025 – ongoing",
      lead: "We are building a new prayer house that will welcome our growing community and become a ministry hub for the whole district.",
      body: "Our congregation has grown from a small gathering into hundreds of people, and our current building can no longer hold everyone who wants to attend. The project includes a new prayer house with a 500-seat hall, rooms for children's and youth ministry, and space for social initiatives. Construction proceeds in stages as donations come in — every hryvnia brings us closer to completion.",
      stats: [{n:"38%", l:"raised so far"}, {n:"420 m²", l:"building area"}, {n:"3", l:"floors"}, {n:"2027", l:"planned completion year"}],
      progress: {raised: "UAH 1,140,000", goal: "UAH 3,000,000"},
      cta: {label:"Support the construction"}
    },
    media: [
      {type:"image", src:"https://picsum.photos/seed/hob-proj-a1/1200/750", alt:"Будівельний майданчик"},
      {type:"image", src:"https://picsum.photos/seed/hob-proj-a2/1200/750", alt:"Проєкт будівлі"},
      {type:"video", src:"https://www.youtube.com/watch?v=ScMzIvxBSi4", alt:"Відео з будівництва"},
      {type:"image", src:"https://picsum.photos/seed/hob-proj-a3/1200/750", alt:"Фундамент"}
    ]
  },
  {
    id: "social-canteen",
    title: "Соціальна їдальня «Дім Хліба»",
    category: "Соціальний проєкт",
    status: "Триває",
    period: "2024 – триває",
    date: "2026-01-10",
    lead: "Щотижнева безкоштовна їдальня та продуктова допомога для малозабезпечених родин, переселенців і людей похилого віку.",
    body: "Щосуботи волонтери церкви готують гарячі обіди та формують продуктові набори для тих, хто опинився у складних життєвих обставинах. Проєкт об'єднує десятки волонтерів і партнерів-донорів та щомісяця допомагає сотням родин у Кривому Розі, включно з переселенцями та родинами захисників.",
    stats: [{n:"860", l:"порцій щомісяця"}, {n:"210", l:"родин під опікою"}, {n:"52", l:"тижні поспіль"}],
    cta: {label:"Стати волонтером", url:"index.html#contacts"},
    en: {
      title: "House of Bread Social Canteen",
      category: "Social Project",
      status: "Ongoing",
      period: "2024 – ongoing",
      lead: "A weekly free canteen and food aid for low-income families, displaced people and the elderly.",
      body: "Every Saturday, church volunteers prepare hot meals and put together food parcels for those facing hard life circumstances. The project brings together dozens of volunteers and donor partners and helps hundreds of families in Kryvyi Rih each month, including displaced people and families of servicemen.",
      stats: [{n:"860", l:"meals per month"}, {n:"210", l:"families supported"}, {n:"52", l:"weeks running"}],
      cta: {label:"Become a volunteer"}
    },
    media: [
      {type:"image", src:"https://picsum.photos/seed/hob-proj-b1/1200/750", alt:"Роздача обідів"},
      {type:"image", src:"https://picsum.photos/seed/hob-proj-b2/1200/750", alt:"Волонтери на кухні"},
      {type:"video", src:"https://youtu.be/ScMzIvxBSi4", alt:"Відео про їдальню"}
    ]
  },
  {
    id: "villages-mission",
    title: "Місіонерська підтримка сіл Криворіжжя",
    category: "Місія",
    status: "Триває",
    period: "2023 – триває",
    date: "2026-01-15",
    lead: "Підтримка малих сільських громад і церков-супутників у Криворізькому районі: продукти, література, регулярні виїзні служіння.",
    body: "Команди церкви щомісяця виїжджають у навколишні села, де немає власної громади віруючих або вона потребує підтримки. Ми привозимо продуктову допомогу, християнську літературу, проводимо богослужіння та дитячі програми. Мета проєкту — засновувати й підтримувати живі громади за межами міста.",
    stats: [{n:"9", l:"сіл охоплено"}, {n:"6", l:"виїзних команд"}, {n:"120+", l:"відвідувань щороку"}],
    cta: {label:"Підтримати місію", url:"https://www.liqpay.ua/uk/checkout/donatedh"},
    en: {
      title: "Mission Support for Kryvyi Rih District Villages",
      category: "Mission",
      status: "Ongoing",
      period: "2023 – ongoing",
      lead: "Supporting small rural communities and satellite churches in the Kryvyi Rih district: food, literature, and regular outreach services.",
      body: "Church teams travel every month to nearby villages that have no congregation of their own or need support. We bring food aid and Christian literature, and hold services and children's programs. The project's goal is to plant and sustain living communities beyond the city.",
      stats: [{n:"9", l:"villages reached"}, {n:"6", l:"outreach teams"}, {n:"120+", l:"visits per year"}],
      cta: {label:"Support the mission"}
    },
    media: [
      {type:"image", src:"https://picsum.photos/seed/hob-proj-c1/1200/750", alt:"Виїзне служіння"},
      {type:"image", src:"https://picsum.photos/seed/hob-proj-c2/1200/750", alt:"Роздача допомоги в селі"}
    ]
  },
  {
    id: "youth-camp-2026",
    title: "Молодіжний табір 2026",
    category: "Молодь",
    status: "Планується",
    period: "Липень 2026",
    date: "2026-02-01",
    lead: "Щорічний табір для підлітків і молоді міста та регіону — тиждень служіння, навчання й дружби.",
    body: "Молодіжний табір збирає підлітків і молодь з церкви та партнерських громад на тиждень активного відпочинку, біблійних занять, спортивних заходів і творчих майстерень. Для багатьох учасників це перший крок до особистих стосунків з Богом. Зараз триває підготовка та збір коштів на оренду локації, харчування й транспорт.",
    stats: [{n:"150", l:"очікується учасників"}, {n:"7", l:"днів служіння"}, {n:"12", l:"волонтерів команди"}],
    progress: {percent: 20, raised: "40 000 грн", goal: "200 000 грн"},
    cta: {label:"Підтримати табір", url:"https://www.liqpay.ua/uk/checkout/donatedh"},
    en: {
      title: "Youth Camp 2026",
      category: "Youth",
      status: "Planned",
      period: "July 2026",
      lead: "An annual camp for teens and young people from the city and region — a week of service, learning and friendship.",
      body: "The youth camp brings together teens and young people from the church and partner communities for a week of active recreation, Bible studies, sports activities and creative workshops. For many participants it is a first step toward a personal relationship with God. Preparations are underway, along with fundraising for the venue, meals and transport.",
      stats: [{n:"150", l:"participants expected"}, {n:"7", l:"days of ministry"}, {n:"12", l:"team volunteers"}],
      progress: {raised: "UAH 40,000", goal: "UAH 200,000"},
      cta: {label:"Support the camp"}
    },
    media: [
      {type:"image", src:"https://picsum.photos/seed/hob-proj-d1/1200/750", alt:"Табір минулого року"},
      {type:"video", src:"https://www.youtube.com/watch?v=ScMzIvxBSi4", alt:"Відео табору"},
      {type:"image", src:"https://picsum.photos/seed/hob-proj-d2/1200/750", alt:"Молодь"},
      {type:"image", src:"https://picsum.photos/seed/hob-proj-d3/1200/750", alt:"Спільнота"}
    ]
  }
];
