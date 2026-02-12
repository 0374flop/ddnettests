const site = fetch('https://www.dtek-krem.com.ua/ua/shutdowns');
site.then(async res => {
    console.log(await res.text());
})