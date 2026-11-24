<?php
/**
 * Header template for UNIFORMA Theme.
 */
?><!doctype html>
<html <?php language_attributes(); ?>>
<head>
    <meta charset="<?php bloginfo('charset'); ?>">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <?php wp_head(); ?>
</head>
<body <?php body_class(); ?>>
<?php wp_body_open(); ?>
<?php
if (function_exists('uniforma_render_global_header')) {
    uniforma_render_global_header();
}
?>
