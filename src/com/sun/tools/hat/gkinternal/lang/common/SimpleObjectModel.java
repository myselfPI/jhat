/*
 * Copyright © 2015 Chris Jester-Young.
 *
 * This code is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the
 * Free Software Foundation; either version 2 of the License, or (at your
 * option) any later version.
 *
 * This code is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License
 * for more details.
 *
 * You should have received a copy of the GNU General Public License along
 * with this work. If not, see <http://www.gnu.org/licenses/>.
 *
 * Linking this library statically or dynamically with other modules is
 * making a combined work based on this library. Thus, the terms and
 * conditions of the GNU General Public License cover the whole combination.
 *
 * As a special exception, the copyright holders of this library give you
 * permission to link this library with independent modules to produce an
 * executable, regardless of the license terms of these independent modules,
 * and to copy and distribute the resulting executable under terms of your
 * choice, provided that you also meet, for each linked independent module,
 * the terms and conditions of the license of that module. An independent
 * module is a module which is not derived from or based on this library.
 * If you modify this library, you may extend this exception to your
 * version of the library, but you are not obligated to do so. If you do
 * not wish to do so, delete this exception statement from your version.
 */

package com.sun.tools.hat.gkinternal.lang.common;

import java.util.Map;

import com.google.common.base.Supplier;

import com.sun.tools.hat.gkinternal.lang.ClassModel;
import com.sun.tools.hat.gkinternal.lang.ModelFactory;
import com.sun.tools.hat.gkinternal.lang.ObjectModel;
import com.sun.tools.hat.gkinternal.model.JavaThing;

/**
 * A simple implementation of {@link ObjectModel} where the required methods
 * are specified by suppliers.
 *
 * @author Chris Jester-Young
 */

public class SimpleObjectModel implements ObjectModel {
    private final ModelFactory factory;
    private final Supplier<ClassModel> classModelSupplier;
    private final Supplier<ClassModel> eigenclassModelSupplier;
    private final Supplier<Map<String, JavaThing>> propertiesSupplier;

    public SimpleObjectModel(ModelFactory factory,
            Supplier<ClassModel> classModelSupplier,
            Supplier<ClassModel> eigenclassModelSupplier,
            Supplier<Map<String, JavaThing>> propertiesSupplier) {
        this.factory = factory;
        this.classModelSupplier = classModelSupplier;
        this.eigenclassModelSupplier = eigenclassModelSupplier;
        this.propertiesSupplier = propertiesSupplier;
    }

    @Override
    public ModelFactory getFactory() {
        return factory;
    }

    @Override
    public ClassModel getClassModel() {
        return classModelSupplier.get();
    }

    @Override
    public ClassModel getEigenclassModel() {
        return eigenclassModelSupplier.get();
    }

    @Override
    public Map<String, JavaThing> getProperties() {
        return propertiesSupplier.get();
    }
}
