// gulp dev - for development - browser-sync + watchers
// gulp - to build everything

// DESTINATION - set the destination path

const argv = require('yargs').argv;
const gulp = require( 'gulp' );
const sass = require( 'gulp-sass' );
const changed = require( 'gulp-changed' );
// const sourcemaps = require( 'gulp-sourcemaps' );
const uglify = require( 'gulp-uglify' );
const concat = require( 'gulp-concat' );
const replace = require( 'gulp-replace' );
const plumber = require( 'gulp-plumber' );
const babel = require( 'gulp-babel' );
const browsersync = require( 'browser-sync' ).create();
const gulpif = require( 'gulp-if' );
const del = require( 'del' );
const addsrc = require( 'gulp-add-src' );
const postcss = require('gulp-postcss');
const autoprefixer = require('autoprefixer');
const rename = require( 'gulp-rename' );
const yaml = require( 'gulp-yaml' );
const jsyaml = require( 'js-yaml' );
const theme = require( 'gulp-shopify-theme' ).create();
const shopifyconfig = require( './config.json' );

const svgmin = require('gulp-svgmin');
const svgstore = require('gulp-svgstore');

var DESTINATION = argv.dest || 'theme';
var USE_JS_UGLIFY = !!(argv.uglify || process.env.USE_JS_UGLIFY);
var USE_SOURCEMAPS = !(argv.nomaps || process.env.DISABLE_SOURCEMAPS);
var USE_BROWSER_SYNC = !!(argv.browsersync || argv.bs || process.env.USE_BROWSER_SYNC || true);
var BROWSER_SYNC_PORT = parseInt(argv.browsersync) || parseInt(argv.bs) || parseInt(process.env.BROWSER_SYNC_PORT) || '3000';

const sourceMappingURLCSSregExp = new RegExp('(.*?[/*]{2,}# sourceMappingURL=)(.*?)([/*]{2})', 'g');
const sourceMappingURLJSregExp = new RegExp('(.*?[/*]{2,}# sourceMappingURL=)(.*?)', 'g');
const sourceMappingURLCSSreplace = '{% raw %}$1{% endraw %}$2{% raw %}$3{% endraw %}';
const sourceMappingURLJSreplace = '{% raw %}$1{% endraw %}$2';

shopifyconfig.root = process.cwd() + '/' + DESTINATION;

gulp.task( 'css', function () {
    return gulp.src( 'src/assets/css/main.scss' )
        .pipe( plumber() )
        // .pipe( sourcemaps.init() )
        .pipe( sass().on('error', sass.logError) )
        // .pipe( replace( /({{|}}|{%|%})/g, '/*!$1*/' ) ) // Comment out Liquid tags, so post-css doesn't trip out
        // .pipe( postcss( [
        //     autoprefixer({browsers: [ 'last 2 versions', 'Explorer >= 9' ]}),
        //     ] ) )
        // .pipe( replace( /\/\*!({{|}}|{%|%})\*\//g, '$1' ) ) // Re-enable Liquid tags
        .pipe( rename( 'ns_all.css' ) )
        // .pipe( sourcemaps.write('.', {sourceMappingURL: makeLiquidSourceMappingURL})) // ns_all.css.map
        .pipe( rename(appendLiquidExt)) // ns_all.css.liquid
        // .pipe( replace( sourceMappingURLCSSregExp, sourceMappingURLCSSreplace ) )
        .pipe( gulp.dest( DESTINATION + '/assets' ) )
        .pipe( theme.stream() );
});

gulp.task( 'js', function () {
    return gulp.src( [ 'src/assets/js/!(main)*.js', 'src/assets/js/main.js' ] )
        .pipe( plumber() )
        // .pipe( sourcemaps.init() )
        .pipe( babel({presets: ['es2015']}) )
        .pipe( concat( 'ns_all.js' ) )
        .pipe( gulpif( USE_JS_UGLIFY, uglify() ) )
        // .pipe( sourcemaps.write('.', {sourceMappingURL: makeLiquidSourceMappingURL}))
        .pipe( rename(appendLiquidExt))
        // .pipe( replace( sourceMappingURLJSregExp, sourceMappingURLJSreplace ) )
        .pipe( gulp.dest( DESTINATION + '/assets' ) )
        .pipe( theme.stream() );
});

gulp.task( 'js-libs', function () {
    return gulp.src( [ 'src/assets/js-libs/jquery.js' , 'src/assets/js-libs/*.js' ] )
        .pipe( plumber() )
        .pipe( concat( 'js_libs.js' ) )
        .pipe( gulpif( USE_JS_UGLIFY, uglify() ) )
        .pipe( gulp.dest( DESTINATION + '/assets' ) )
        .pipe( theme.stream() );
});

gulp.task( 'fonts', function () {
    return gulp.src( [ 'src/assets/fonts/**/*.{ttf,woff,woff2,eof,eot,otf,svg}' ] )
        .pipe( plumber() )
        .pipe( changed( DESTINATION + '/assets', {hasChanged: changed.compareSha1Digest} ) )
        .pipe( rename( flatten ))
        .pipe( rename({ dirname: '', prefix: 'fonts_' }))
        .pipe( gulp.dest( DESTINATION + '/assets' ) )
        .pipe( theme.stream() );
});

gulp.task( 'images', function () {
    return gulp.src( [ 'src/assets/images/**/*.{svg,png,jpg,jpeg,gif,ico}' ] )
        .pipe( plumber() )
        .pipe( changed( DESTINATION + '/assets' ) )
        .pipe( rename( flatten ))
        .pipe( rename({ dirname: '', prefix: '' }))
        .pipe( gulp.dest( DESTINATION + '/assets' ) )
        .pipe( theme.stream() );
});

gulp.task( 'icons', function () {
    return gulp.src( [ 'src/assets/icons/**/*.svg' ] )
        .pipe( plumber() )
        .pipe( changed( DESTINATION + '/assets' ) )
        .pipe(svgmin({
          plugins: [{
            removeStyleElement: true
          }, {
            removeAttrs: {
              attrs: ['fill', 'stroke', 'fill.*', 'stroke.*']
            }
          }]
        }))
        .pipe(svgstore({ inlineSvg: true }))
        .pipe( gulp.dest( DESTINATION + '/snippets' ) )
        .pipe( theme.stream() );
});

gulp.task( 'copy', function () {
    return gulp.src( [ 'src/{layout,snippets,templates,sections}/**/*.*' ] )
        .pipe( plumber() )
        .pipe( replace( /{% schema %}([^]*.+[^]*){% endschema %}/gi, replaceYAMLwithJSON ) )
        // .pipe( replace(/({%)(?!\s*?(?:end)?(?:raw|schema|javascript|stylesheet)\s*?)(.+?)(%})/g, '$1- $2 -$3') ) // make whitespace-insensitive tags {% -> {%-
        .pipe( replace( /^\s*[\r\n]/gm, '' ) ) // remove empty lines
        .pipe( changed( DESTINATION, {hasChanged: changed.compareSha1Digest} ) )
        // .pipe( changed( DESTINATION, {hasChanged: changed.compareLastModifiedTime} ) )
        .pipe( gulp.dest( DESTINATION ) )
        .pipe( theme.stream() );
});

gulp.task( 'configs', function () {
    return gulp.src( [ 'src/{config,locales}/**/*.*' ] )
        .pipe( plumber() )
        .pipe( yaml({space: 2}) )
        .pipe( changed( DESTINATION, {hasChanged: changed.compareSha1Digest} ) )
        .pipe( gulp.dest( DESTINATION ) )
        .pipe( theme.stream() );
});

gulp.task('reload-on-css', gulp.series('css', reload));
gulp.task('reload-on-js', gulp.series('js', reload));
gulp.task('reload-on-js-libs', gulp.series('js-libs', reload));
gulp.task('reload-on-fonts', gulp.series('fonts', reload));
gulp.task('reload-on-images', gulp.series('images', reload));
gulp.task('reload-on-icons', gulp.series('icons', reload));
gulp.task('reload-on-copy', gulp.series('copy', 'configs', reload));

function reload (done) {
    if (!USE_BROWSER_SYNC) return done();
    browsersync.reload(); done();
}

gulp.task( 'browsersync', function (done) {
    if (!USE_BROWSER_SYNC) return done();
    browsersync.init({
        port: BROWSER_SYNC_PORT, ui: { port: BROWSER_SYNC_PORT + 1 },
        proxy: 'https://'+ shopifyconfig.shop_name +'.myshopify.com',
        browser: [],
        notify: false,
        startPath: "/?preview_theme_id=" + shopifyconfig.theme_id,
    }, done);
});


gulp.task( 'theme', function (done) {
    theme.init( shopifyconfig );
    done();
});

// Deletes it all 😱
gulp.task( 'purge', gulp.series('theme', function (done) {
    theme.purge();
    done();
}));

gulp.task( 'watch', gulp.series(function(done) {
    USE_JS_UGLIFY = false;

    // Watch & run tasks
    gulp.watch( 'src/assets/{css,css-libs}/**/*.{css,less,scss,liquid}', gulp.series('reload-on-css', reload) );
    gulp.watch( 'src/assets/js/**/*.js', gulp.series('reload-on-js', reload) );
    gulp.watch( 'src/assets/js-libs/**/*.js', gulp.series('reload-on-js-libs', reload) );
    gulp.watch( 'src/assets/fonts/**/*', gulp.series('reload-on-fonts', reload) );
    gulp.watch( 'src/assets/images/**/*', gulp.series('reload-on-images', reload) );
    gulp.watch( 'src/assets/icons/**/*', gulp.series('reload-on-icons', reload) );
    gulp.watch( 'src/{layout,config,snippets,sections,templates,locales}/**/*', gulp.series('reload-on-copy', reload));

    done();
}));

gulp.task( 'default', gulp.series('css', 'js', 'js-libs', 'fonts', 'images', 'icons', 'copy', 'configs') );
gulp.task( 'build', gulp.series('theme', 'default'));
gulp.task( 'dev', gulp.series('theme', 'default', 'browsersync', 'watch' ) );
gulp.task( 'clean', function () {
    return del(DESTINATION);
});


console.log('DESTINATION', DESTINATION);
console.log('USE_JS_UGLIFY', USE_JS_UGLIFY);
console.log('USE_SOURCEMAPS', USE_SOURCEMAPS);
console.log('USE_BROWSER_SYNC', USE_BROWSER_SYNC);
console.log('BROWSER_SYNC_PORT', BROWSER_SYNC_PORT);

function replaceYAMLwithJSON (match, g1) {
    if (match) {
        var yamlString = g1.replace(/{% (end)?schema %}/, '');
        var parsedYaml = jsyaml.safeLoad(yamlString);
        var jsonString = JSON.stringify(parsedYaml, null, '    ');
        return '{% schema %}\n' + jsonString + '\n{% endschema %}';
    }
}

function makeLiquidSourceMappingURL (file) {
    return '{{"' + file.relative + '.map" | asset_url }}';
}

function appendLiquidExt (path) {
    if (path.extname === '.map') return;
    if (path.extname === '.css') {
        path.extname = '.scss';
    }
    path.basename += path.extname;
    path.extname = '.liquid';
}

function flatten (path) {
    if (path.dirname !== '.') {
        path.basename = path.dirname.replace('/', '_') + '_' + path.basename;
    }
}
