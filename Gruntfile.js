'use strict';

// # Globbing
// for performance reasons we're only matching one level down:
// 'test/spec/{,*/}*.js'
// use this if you want to recursively match all subfolders:
// 'test/spec/**/*.js'

module.exports = function (grunt) {

  // Load grunt tasks automatically
  require('load-grunt-tasks')(grunt);

  // Time how long tasks take. Can help when optimizing build times
  require('time-grunt')(grunt);

  // Configurable paths
  var config = {
    app: 'app',
    temp: 'temp',
    dist: 'dist'
  };

  grunt.initConfig({

    // Project settings
    config: config,

    // Watches files for changes and runs tasks based on the changed files
    watch: {
      gruntfile: {
        files: ['Gruntfile.js']
      },
      livereload: {
        options: {
          livereload: 35729
        },
        files: [
          '<%= config.app %>/scripts/{,*/}*.*',
          '<%= config.app %>/styles/{,*/}*.*',
          '<%= config.app %>/*.html',
          '<%= config.app %>/images/{,*/}*.{png,jpg,jpeg,gif,webp,svg}',
          '<%= config.app %>/manifest.json',
          '<%= config.app %>/_locales/{,*/}*.json'
        ],
        tasks: ['build']
      }
    },

    // Empties folders to start fresh
    clean: {
      dist: {
        files: [{
          dot: true,
          src: [
            '<%= config.dist %>/*',
            '!<%= config.dist %>/.git*'
          ]
        }]
      },
      temp: {
        files: [{
          dot: true,
          src: [
            '<%= config.temp %>/*'
          ]
        }]
      }
    },

    // Make sure code styles are up to par and there are no obvious mistakes
    jshint: {
      options: {
        jshintrc: '.jshintrc',
        reporter: require('jshint-stylish')
      },
      all: [
        'Gruntfile.js',
        '<%= config.app %>/scripts/{,*/}*.js',
        '!<%= config.app %>/vendor/*'
      ]
    },

    // Copies remaining files to places other tasks can use
    copy: {
      dist: {
        files: [{
          expand: true,
          dot: true,
          cwd: '<%= config.app %>',
          dest: '<%= config.dist %>',
          src: [
            '**',
            '!bower_components/**',
            '!**/*.jsx',
            '!**/*.less'
          ]
        }]
      },
      release: {
        files: [{
          expand: true,
          dot: true,
          cwd: '<%= config.dist %>',
          dest: '<%= config.temp %>',
          src: [
            '**'
          ]
        }]
      }
    },

    // Auto buildnumber, exclude debug files. smart builds that event pages
    chromeManifest: {
      dist: {
        options: {
          buildnumber: true,
          background: {
            target: 'scripts/background.js',
            exclude: [
              'scripts/chromereload.js'
            ]
          }
        },
        src: '<%= config.app %>',
        dest: '<%= config.dist %>'
      }
    },

    react: {
      files: {
        expand: true,
        cwd: '<%= config.app %>/',
        src: ['**/*.jsx'],
        dest: '<%= config.temp %>/',
        ext: '.js'
      }
    },

    browserify: {
      'devtools-panel': {
        src: '<%= config.temp %>/scripts/devtools-panel.js',
        dest: '<%= config.dist %>/scripts/devtools-panel.js'
      }
    },

    less: {
      'dist': {
        expand: true,
        cwd: '<%= config.app %>',
        src: '**/*.less',
        dest: '<%= config.dist %>',
        ext: '.css'
      }
    },

    uglify: {
      dist: {
        files: [{
          expand: true,
          cwd: '<%= config.temp %>',
          src: '**/*.js',
          dest: '<%= config.dist %>'
        }]
      }
    },

    preprocess : {
      options: {
        inline: true,
        context : {
          DEBUG: false
        }
      },
      product : {
        src : [
          '<%= config.dist %>/**/*.html'
        ]
      }
    },

    // Compres dist files to package
    compress: {
      dist: {
        options: {
          archive: function() {
            var manifest = grunt.file.readJSON('app/manifest.json');
            return 'package/raccoon-' + manifest.version + '.zip';
          }
        },
        files: [{
          expand: true,
          cwd: 'dist/',
          src: ['**'],
          dest: ''
        }]
      }
    },

    bower: {
      install: {
        options: {
          targetDir: '<%= config.app %>/vendor',
          layout: 'byComponent',
          install: true,
          cleanTargetDir: true,
          cleanBowerDir: false,
          bowerOptions: {}
        }
      }
    }
  });


  grunt.registerTask('build', [
    'jshint',
    'clean:dist',
    'copy:dist',
    'clean:temp',
    'react',
    'browserify',
    'less'
  ]);

  grunt.registerTask('debug', [
    'bower:install',
    'build',
    'watch'
  ]);

  grunt.registerTask('release', [
    'build',
    'chromeManifest:dist',
    'preprocess:product',
    'clean:temp',
    'copy:release',
    'uglify',
    'compress'
  ]);

  grunt.registerTask('default', [
    'bower:install',
    'release'
  ]);
};
