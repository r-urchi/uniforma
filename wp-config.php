<?php
define( 'WP_CACHE', true );

/**
 * The base configuration for WordPress
 *
 * The wp-config.php creation script uses this file during the installation.
 * You don't have to use the web site, you can copy this file to "wp-config.php"
 * and fill in the values.
 *
 * This file contains the following configurations:
 *
 * * Database settings
 * * Secret keys
 * * Database table prefix
 * * Localized language
 * * ABSPATH
 *
 * @link https://wordpress.org/support/article/editing-wp-config-php/
 *
 * @package WordPress
 */

// ** Database settings - You can get this info from your web host ** //
/** The name of the database for WordPress */
define( 'DB_NAME', 'u547344254_JwfBR' );

/** Database username */
define( 'DB_USER', 'u547344254_FvocY' );

/** Database password */
define( 'DB_PASSWORD', '8KdX649k0k' );

/** Database hostname */
define( 'DB_HOST', '127.0.0.1' );

/** Database charset to use in creating database tables. */
define( 'DB_CHARSET', 'utf8' );

/** The database collate type. Don't change this if in doubt. */
define( 'DB_COLLATE', '' );

/**#@+
 * Authentication unique keys and salts.
 *
 * Change these to different unique phrases! You can generate these using
 * the {@link https://api.wordpress.org/secret-key/1.1/salt/ WordPress.org secret-key service}.
 *
 * You can change these at any point in time to invalidate all existing cookies.
 * This will force all users to have to log in again.
 *
 * @since 2.6.0
 */
define( 'AUTH_KEY',          'czxp?56_$4!eH.L3yQ6sIhD;AYZQ}{-?N-huM%U>{:t1j^eg{jp~B4fhp[IE/DCc' );
define( 'SECURE_AUTH_KEY',   'Dy/[%ZF<o K[;0>u;w[X?c8nX~i#dy:rB`bbz]f(4PYDLdT.zRXl50evLa?40}?K' );
define( 'LOGGED_IN_KEY',     'f77*nljm([8]hr9c =DR4!;F-<,ARp[AD)S7AI>vL8TuI;`pCWo5jeH}vvH4/yDU' );
define( 'NONCE_KEY',         '+LC/n{0FF@VB4`l)pftlw)*L^w Q7nd-/^@>oR8U*sDgf^%%|FENj93x:{[+K[,P' );
define( 'AUTH_SALT',         ';&czR$w#t54~t@Wr[8rgF<541LLn&lz7Wi3{ks|1eV!^c*3r;a/=Y@~w(7G|WCdW' );
define( 'SECURE_AUTH_SALT',  'sy[f^n]i&pq_)04:$*,26wIFgdbNZ&}1Aw6S%9kGSedENGF`/*Cm~5Q$5LR7zT/+' );
define( 'LOGGED_IN_SALT',    'l^NfmZFg:$R4}%;P:N)L=+(K`La%b:.$xd>gwe)ur`@e->TYAdWvm]0-6[Z;f]$.' );
define( 'NONCE_SALT',        'x3^l{_oxKFpV6@eK1%0+~lM0FzjSN1i5|#KSDGc|pYE-84oX{.uVtmdhgYwAQS-C' );
define( 'WP_CACHE_KEY_SALT', ' RUwQC3z%Z7pQz4]=/7gpPuJK7GW55xe?QBb[V@;DPOAdO.,D&4X7;.??@]]HI;!' );


/**#@-*/

/**
 * WordPress database table prefix.
 *
 * You can have multiple installations in one database if you give each
 * a unique prefix. Only numbers, letters, and underscores please!
 */
$table_prefix = 'wp_';


/* Add any custom values between this line and the "stop editing" line. */



/**
 * For developers: WordPress debugging mode.
 *
 * Change this to true to enable the display of notices during development.
 * It is strongly recommended that plugin and theme developers use WP_DEBUG
 * in their development environments.
 *
 * For information on other constants that can be used for debugging,
 * visit the documentation.
 *
 * @link https://wordpress.org/support/article/debugging-in-wordpress/
 */
if ( ! defined( 'WP_DEBUG' ) ) {
	define( 'WP_DEBUG', false );
}

define( 'FS_METHOD', 'direct' );
define( 'COOKIEHASH', '198dd4dec658b89aaff0852687c0dce7' );
define( 'WP_AUTO_UPDATE_CORE', 'minor' );
/* That's all, stop editing! Happy publishing. */

/** Absolute path to the WordPress directory. */
if ( ! defined( 'ABSPATH' ) ) {
	define( 'ABSPATH', __DIR__ . '/' );
}

/** Sets up WordPress vars and included files. */
require_once ABSPATH . 'wp-settings.php';
