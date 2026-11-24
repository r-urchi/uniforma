<?php
/**
 * Generic page template for UNIFORMA Theme.
 */
get_header();
?>

<main id="main-content" class="uniforma-page-content">
    <div class="uniforma-page-content__inner">
        <?php
        while (have_posts()) :
            the_post();
            the_content();
        endwhile;
        ?>
    </div>
</main>

<?php
get_footer();
